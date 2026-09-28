import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { leads } from "@/db/schema";
import { corsHeaders } from "@/lib/leads-intake";
import { verifyToken } from "@/lib/email/tokens";
import { publicMeta } from "@/lib/kitRestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Exchange a restore link for the customer's kit.
 *
 *   POST /api/kit/restore  { token }  ->  { ok, lead: { id, name, email, phone, meta } }
 *
 * POST (called by the page's script), not GET: email security scanners fetch
 * every link in a message, and they shouldn't be handed someone's answers.
 * The token is good for its lifetime rather than one use, for the same
 * reason — a scanner opening it first must not burn the customer's link.
 */
export async function POST(req: NextRequest) {
  const headers = corsHeaders(req.headers.get("origin"));
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400, headers });
  }
  const v = verifyToken(String(body.token || ""), "restore");
  if (!v.ok) {
    return NextResponse.json(
      { ok: false, error: v.reason === "expired" ? "expired" : "invalid" },
      { status: 400, headers },
    );
  }
  const [lead] = await db.select().from(leads).where(eq(leads.id, v.leadId)).limit(1);
  if (!lead) return NextResponse.json({ ok: false, error: "invalid" }, { status: 404, headers });

  return NextResponse.json(
    { ok: true, lead: { id: lead.id, name: lead.name, email: lead.email, phone: lead.phone, meta: publicMeta(lead.meta) } },
    { status: 200, headers },
  );
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}
