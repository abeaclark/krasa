import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { leads } from "@/db/schema";
import {
  notifySlackNewLead,
  notifySlackLeadUpdate,
  type SlackMessageRef,
} from "@/lib/slack";
import {
  normalizeLead,
  cleanLeadId,
  corsHeaders,
  type LeadIntakePayload,
} from "@/lib/leads-intake";

// postgres-js needs the Node runtime (not edge).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The single global lead-intake endpoint.
 *
 *   POST https://krasadev.com/api/leads
 *   Content-Type: application/json
 *   { "site": "krasadev.com", "source": "contact", "email": "...", ... }
 *
 * Any of the five sites can post here. The lead is stored (attributed to its
 * site, stamped with a received date, status defaulting to "new") and a Slack
 * notification fires. CORS is restricted to the known sites + localhost.
 *
 * UPDATES: include `leadId` (the `id` returned by the original POST) to update
 * that lead instead of creating a new one. `meta` is shallow-merged into the
 * existing meta, contact fields fill in if previously empty, and the Slack
 * notification posts as a threaded reply under the original lead message
 * (requires the bot-token transport — see lib/slack.ts). An optional `stage`
 * string labels the update, e.g. "paperwork-details" or "letters-downloaded".
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  let body: LeadIntakePayload;
  try {
    body = (await req.json()) as LeadIntakePayload;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400, headers },
    );
  }

  // Honeypot tripped: pretend success so the bot moves on, but don't store or
  // notify. (Applies to both creates and updates.)
  if (typeof body.hp === "string" && body.hp.trim().length > 0) {
    return NextResponse.json({ ok: true, id: null }, { status: 201, headers });
  }

  // ---- Update path -------------------------------------------------------
  const leadId = cleanLeadId(body.leadId);
  if (body.leadId !== undefined && !leadId) {
    return NextResponse.json(
      { ok: false, error: "Invalid leadId" },
      { status: 400, headers },
    );
  }
  if (leadId) {
    return updateLead(leadId, body, headers);
  }

  // ---- Create path (unchanged behavior) ----------------------------------
  const result = normalizeLead(body);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400, headers },
    );
  }

  try {
    const [inserted] = await db
      .insert(leads)
      .values({
        site: result.lead.site,
        source: result.lead.source,
        name: result.lead.name,
        email: result.lead.email,
        phone: result.lead.phone,
        message: result.lead.message,
        meta: result.lead.meta,
        // status defaults to "new" in the schema
      })
      .returning();

    // Fire the Slack notification but don't let it block/fail the response.
    // When the bot transport is configured we get the message ref back — store
    // it in meta._slack so later updates can thread under this message.
    const slackRef = await notifySlackNewLead(inserted);
    if (slackRef) {
      await db
        .update(leads)
        .set({
          meta: { ...(inserted.meta as Record<string, unknown>), _slack: slackRef },
        })
        .where(eq(leads.id, inserted.id));
    }

    return NextResponse.json(
      { ok: true, id: inserted.id },
      { status: 201, headers },
    );
  } catch (err) {
    console.error("[leads] failed to store lead", err);
    return NextResponse.json(
      { ok: false, error: "Failed to store lead" },
      { status: 500, headers },
    );
  }
}

async function updateLead(
  leadId: string,
  body: LeadIntakePayload,
  headers: Record<string, string>,
) {
  try {
    const [existing] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Lead not found" },
        { status: 404, headers },
      );
    }

    const incomingMeta =
      body.meta && typeof body.meta === "object" && !Array.isArray(body.meta)
        ? (body.meta as Record<string, unknown>)
        : {};
    const stage =
      typeof body.stage === "string" && body.stage.trim()
        ? body.stage.trim().slice(0, 120)
        : null;

    const existingMeta = (existing.meta ?? {}) as Record<string, unknown>;
    const mergedMeta: Record<string, unknown> = {
      ...existingMeta,
      ...incomingMeta,
      ...(stage
        ? {
            _stages: [
              ...(Array.isArray(existingMeta._stages) ? existingMeta._stages : []),
              { stage, at: new Date().toISOString() },
            ],
          }
        : {}),
    };

    const [updated] = await db
      .update(leads)
      .set({
        meta: mergedMeta,
        // Fill in contact fields the original submission didn't have; never
        // overwrite existing values from an unauthenticated update.
        name: existing.name ?? (typeof body.name === "string" ? body.name.trim().slice(0, 200) || null : null),
        email: existing.email ?? (typeof body.email === "string" ? body.email.trim().slice(0, 320) || null : null),
        phone: existing.phone ?? (typeof body.phone === "string" ? body.phone.trim().slice(0, 50) || null : null),
        updated_at: new Date(),
      })
      .where(eq(leads.id, leadId))
      .returning();

    const parent = (existingMeta._slack ?? null) as SlackMessageRef | null;
    await notifySlackLeadUpdate(updated, stage, incomingMeta, parent);

    return NextResponse.json({ ok: true, id: updated.id }, { status: 200, headers });
  } catch (err) {
    console.error("[leads] failed to update lead", err);
    return NextResponse.json(
      { ok: false, error: "Failed to update lead" },
      { status: 500, headers },
    );
  }
}

// CORS preflight for cross-origin form posts from the other sites.
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin")),
  });
}
