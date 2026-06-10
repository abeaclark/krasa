import type { Lead } from "@/db/schema";

/**
 * Post a "new lead" notification to Slack via an Incoming Webhook.
 *
 * Set SLACK_WEBHOOK_URL to the webhook for the channel you want leads in.
 * If it's unset (e.g. local dev), this no-ops instead of throwing — a missing
 * Slack config should never break lead capture.
 *
 * Failures here are swallowed by design: the lead is already persisted, and a
 * flaky Slack call shouldn't surface as a 500 to the submitting site.
 */
export async function notifySlackNewLead(lead: Lead): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[slack] SLACK_WEBHOOK_URL not set — skipping notification");
    }
    return;
  }

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

  // Surface a few interesting meta keys inline (everything is still in the DB).
  const meta = (lead.meta ?? {}) as Record<string, unknown>;
  const metaPreview = Object.entries(meta)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .slice(0, 8)
    .map(([k, v]) => `• *${k}:* ${formatMetaValue(v)}`)
    .join("\n");

  const blocks: unknown[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `🎯 New lead — ${lead.site}`, emoji: true },
    },
    ...(fields.length
      ? [{ type: "section", fields: fields.slice(0, 10) }]
      : []),
    ...(lead.message
      ? [
          {
            type: "section",
            text: { type: "mrkdwn", text: `*Message:*\n>${lead.message.replace(/\n/g, "\n>")}` },
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

  const text = `New lead from ${lead.site}${lead.email ? ` (${lead.email})` : ""}`;

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, blocks }),
    });
    if (!res.ok) {
      console.error(`[slack] webhook responded ${res.status}: ${await res.text()}`);
    }
  } catch (err) {
    console.error("[slack] failed to post notification", err);
  }
}

function formatMetaValue(v: unknown): string {
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
