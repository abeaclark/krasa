import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { leads } from "@/db/schema";
import { dripState } from "@/lib/email/drip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read-only. The frontend server authenticates and supplies both session identifiers. */
export async function POST(req: NextRequest) {
  const secret = process.env.INTERNAL_API_SECRET?.trim();
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.leadId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.leadId) || typeof body.clientRef !== "string") return NextResponse.json({ ok: false }, { status: 400 });
  const [lead] = await db.select().from(leads).where(eq(leads.id, body.leadId)).limit(1);
  const meta = (lead?.meta ?? {}) as Record<string, unknown>;
  if (!lead || lead.site !== "refundauto.com" || meta.clientRef !== body.clientRef) return NextResponse.json({ ok: true, offer: null });
  const offer = dripState(meta).offer;
  return NextResponse.json({ ok: true, offer: !meta.purchase && offer && Date.parse(offer.expiresAt) > Date.now() ? offer : null }, { headers: { "Cache-Control": "no-store" } });
}
