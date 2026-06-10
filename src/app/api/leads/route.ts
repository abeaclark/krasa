import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { leads } from "@/db/schema";
import { notifySlackNewLead } from "@/lib/slack";
import {
  normalizeLead,
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

  const result = normalizeLead(body);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400, headers },
    );
  }

  // Honeypot tripped: pretend success so the bot moves on, but don't store or
  // notify. (Flip to storing with status "spam" if you'd rather keep them.)
  if (result.isSpam) {
    return NextResponse.json({ ok: true, id: null }, { status: 201, headers });
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
    await notifySlackNewLead(inserted);

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

// CORS preflight for cross-origin form posts from the other sites.
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin")),
  });
}
