import type { Lead } from "@/db/schema";

/**
 * Slack notifications for leads.
 *
 * Two transports, picked automatically:
 *
 *  1. Bot token (preferred): set SLACK_BOT_TOKEN (xoxb-…) and
 *     SLACK_LEADS_CHANNEL (channel ID, e.g. C0123456789). New leads post via
 *     chat.postMessage, which returns the message `ts` — we hand that back to
 *     the caller to store on the lead, and every subsequent update posts as a
 *     REPLY IN THE SAME THREAD. This is what keeps the channel quiet.
 *     (Remember to /invite the bot to the channel.)
 *
 *  2. Incoming webhook (fallback): SLACK_WEBHOOK_URL, the original setup.
 *     Webhooks don't return `ts`, so threading is impossible — updates fall
 *     back to a compact one-liner in the channel.
 *
 * All failures are swallowed by design: the lead is already persisted, and a
 * flaky Slack call should never surface as a 500 to the submitting site.
 */

export interface SlackMessageRef {
  channel: string;
  ts: string;
}

interface SlackPayload {
  text: string;
  blocks?: unknown[];
}

function botConfig(): { token: string; channel: string } | null {
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_LEADS_CHANNEL;
  return token && channel ? { token, channel } : null;
}

/** Post via chat.postMessage; returns the message ref (needed for threading). */
async function postViaBot(
  payload: SlackPayload,
  threadTs?: string,
): Promise<SlackMessageRef | null> {
  const cfg = botConfig();
  if (!cfg) return null;
  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${cfg.token}`,
      },
      body: JSON.stringify({
        channel: cfg.channel,
        ...payload,
        ...(threadTs ? { thread_ts: threadTs } : {}),
      }),
    });
    const data = (await res.json()) as {
      ok: boolean;
      ts?: string;
      channel?: string;
      error?: string;
    };
    if (!data.ok) {
      console.error(`[slack] chat.postMessage failed: ${data.error}`);
      return null;
    }
    return data.ts && data.channel
      ? { channel: data.channel, ts: data.ts }
      : null;
  } catch (err) {
    console.error("[slack] failed to post via bot", err);
    return null;
  }
}

/** Post via the legacy incoming webhook (no ts returned, so no threading). */
async function postViaWebhook(payload: SlackPayload): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[slack] no Slack transport configured — skipping");
    }
    return;
  }
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(`[slack] webhook responded ${res.status}: ${await res.text()}`);
    }
  } catch (err) {
    console.error("[slack] failed to post notification", err);
  }
}

// ---- Message builders ------------------------------------------------------

function buildNewLeadPayload(lead: Lead): SlackPayload {
  const fields: { type: "mrkdwn"; text: string }[] = [];
  const addField = (label: string, value?: string | null) => {
    if (value && value.trim()) {
      fields.push({ type: "mrkdwn", text: `*${label}:*\n${value}` });
    }
  };

  addField("Name", lead.name);
  addField("Email", lead.email);
  addField("Phone", lead.phone);
  addField("Source", lead.source);
  addField("Status", lead.status);

  // Surface the interesting meta keys inline (everything is still in the DB).
  // 16, not 8: the RefundAuto funnel alone writes ~15 answers, and truncating
  // at 8 was hiding the actual product selections.
  const meta = (lead.meta ?? {}) as Record<string, unknown>;
  const metaPreview = metaLines(meta, 16);

  const blocks: unknown[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `🎯 New lead — ${lead.site}`, emoji: true },
    },
    ...(fields.length ? [{ type: "section", fields: fields.slice(0, 10) }] : []),
    ...(lead.message
      ? [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Message:*\n>${lead.message.replace(/\n/g, "\n>")}`,
            },
          },
        ]
      : []),
    ...(metaPreview
      ? [{ type: "section", text: { type: "mrkdwn", text: `*Details:*\n${metaPreview}` } }]
      : []),
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Lead \`${lead.id}\` · received ${new Date(lead.created_at).toISOString()}`,
        },
      ],
    },
  ];

  return {
    text: `New lead from ${lead.site}${lead.email ? ` (${lead.email})` : ""}`,
    blocks,
  };
}

function buildUpdatePayload(
  lead: Lead,
  stage: string | null,
  changedMeta: Record<string, unknown>,
): SlackPayload {
  const label = stage ? stageLabel(stage) : "Lead updated";
  const preview = metaLines(changedMeta, 10);
  const who = lead.name || lead.email || `lead ${lead.id.slice(0, 8)}`;

  return {
    text: `${label} — ${who} (${lead.site})`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${label}* — ${who}${preview ? `\n${preview}` : ""}`,
        },
      },
    ],
  };
}

function stageLabel(stage: string): string {
  const map: Record<string, string> = {
    "paperwork-details": "📝 Paperwork details added",
    "letters-generated": "📄 Letters generated",
    "letters-downloaded": "⬇️ Letters downloaded",
  };
  return map[stage] || `🔁 Update: ${stage}`;
}

/** Plumbing the reader doesn't care about — still in the DB, just not in Slack. */
const HIDDEN_META_KEYS = new Set(["clientRef"]);

/**
 * Preferred display order. The funnel writes meta in whatever order the object
 * literal happens to be in, so without this the truncation at `max` can drop
 * the actual answers (productTypes, vehicleStatus) in favour of plumbing.
 * Unlisted keys keep their natural order, after these.
 */
const META_KEY_ORDER = [
  "vehicleStatus",
  "purchaseYear",
  "loanStatus",
  "vehicleCondition",
  "vehiclePrice",
  "hasProducts",
  "productTypes",
  "vscProviderSlug",
  "gapProviderSlug",
  "hasDocuments",
  // Keep these two ABOVE the long tail of paperwork fields — they're the whole
  // point of the upload flow, and ranking them last let truncation eat them.
  "documents",
  "uploadFailed",
  "lender",
  "state",
  "mileage",
];

function metaRank(key: string): number {
  const i = META_KEY_ORDER.indexOf(key);
  return i === -1 ? 500 : i;
}

function metaLines(meta: Record<string, unknown>, max: number): string {
  return Object.entries(meta)
    .filter(([k]) => !k.startsWith("_") && !HIDDEN_META_KEYS.has(k))
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .sort(([a], [b]) => metaRank(a) - metaRank(b))
    .slice(0, max)
    .map(([k, v]) =>
      k === "documents"
        ? `• *documents:* ${formatDocuments(v)}`
        : `• *${k}:* ${formatMetaValue(v)}`,
    )
    .join("\n");
}

function formatMetaValue(v: unknown): string {
  // Map each element rather than joining blindly — an array of objects used to
  // render as "[object Object], [object Object]".
  if (Array.isArray(v)) return v.map(formatMetaValue).join(", ");
  if (v && typeof v === "object") return JSON.stringify(v).slice(0, 300);
  return String(v);
}

function humanBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Render uploaded paperwork as "3 files · name (size), …" plus a link to the
 * folder in the Supabase dashboard.
 *
 * Deliberately a dashboard link, not a signed URL: signed URLs expire but Slack
 * messages are forever, so an inline signed link would be a dead link the next
 * time anyone scrolls back. The dashboard link works as long as you can log in.
 */
function formatDocuments(v: unknown): string {
  if (!Array.isArray(v) || v.length === 0) return "none";

  const docs = v.filter((d): d is Record<string, unknown> => !!d && typeof d === "object");
  if (docs.length === 0) return formatMetaValue(v);

  const listed = docs.slice(0, 5).map((d) => {
    const name = typeof d.name === "string" ? d.name : "document";
    const size = typeof d.size === "number" ? humanBytes(d.size) : "";
    return size ? `${name} (${size})` : name;
  });
  const more = docs.length > listed.length ? ` +${docs.length - listed.length} more` : "";

  const summary = `${docs.length} file${docs.length === 1 ? "" : "s"} · ${listed.join(", ")}${more}`;
  const link = dashboardFolderLink(typeof docs[0].path === "string" ? docs[0].path : "");

  return link ? `${summary}\n  ${link}` : summary;
}

/** Slack-mrkdwn link to the Storage folder holding this lead's documents. */
function dashboardFolderLink(objectPath: string): string | null {
  const url = process.env.SUPABASE_URL?.trim();
  if (!url || !objectPath) return null;

  const folder = objectPath.split("/").slice(0, -1).join("/");
  if (!folder) return null;

  try {
    const projectRef = new URL(url).hostname.split(".")[0];
    const bucket = process.env.SUPABASE_LEAD_DOCS_BUCKET?.trim() || "lead-documents";
    const href = `https://supabase.com/dashboard/project/${projectRef}/storage/buckets/${bucket}?path=${encodeURIComponent(folder)}`;
    return `<${href}|Open in Supabase>`;
  } catch {
    return null;
  }
}

// ---- Public API ------------------------------------------------------------

/**
 * Notify Slack of a brand-new lead. Returns the posted message ref when the
 * bot transport is configured (store it on the lead to enable threaded
 * updates); null when using the webhook fallback.
 */
export async function notifySlackNewLead(
  lead: Lead,
): Promise<SlackMessageRef | null> {
  const payload = buildNewLeadPayload(lead);
  const ref = await postViaBot(payload);
  if (ref) return ref;
  await postViaWebhook(payload);
  return null;
}

/**
 * Notify Slack of an update to an existing lead. Threads under the original
 * message when possible (bot transport + stored ref); otherwise posts a
 * compact standalone line.
 */
export async function notifySlackLeadUpdate(
  lead: Lead,
  stage: string | null,
  changedMeta: Record<string, unknown>,
  parent: SlackMessageRef | null,
): Promise<void> {
  const payload = buildUpdatePayload(lead, stage, changedMeta);
  if (parent && botConfig()) {
    const ref = await postViaBot(payload, parent.ts);
    if (ref) return;
  }
  // Fallback: bot without a stored parent, or webhook-only setups.
  const ref = await postViaBot(payload);
  if (!ref) await postViaWebhook(payload);
}
