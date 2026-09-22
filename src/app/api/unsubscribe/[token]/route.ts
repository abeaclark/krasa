import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { leads } from "@/db/schema";
import { verifyToken } from "@/lib/email/tokens";
import { EMAIL } from "@/lib/email/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Unsubscribe from the follow-up sequence.
 *
 *   GET  /api/unsubscribe/<token>   — the visible footer link
 *   POST /api/unsubscribe/<token>   — RFC 8058 one-click, called by the mail
 *                                     client itself with no human involved
 *
 * Both do the same thing, immediately and without asking a question. An
 * unsubscribe that works first time is what stops someone reaching for the
 * spam button instead, and the spam button is what damages the sending domain.
 *
 * This does not delete anything — it only stops the check-ins. Deletion is a
 * separate request, handled by a human, as the privacy policy says.
 */
async function unsubscribe(token: string): Promise<boolean> {
  const v = verifyToken(token, "unsubscribe");
  if (!v.ok) return false;

  const [lead] = await db.select().from(leads).where(eq(leads.id, v.leadId)).limit(1);
  if (!lead) return false;

  const meta = (lead.meta ?? {}) as Record<string, unknown>;
  await db
    .update(leads)
    .set({
      meta: { ...meta, emailUnsubscribedAt: new Date().toISOString() },
      updated_at: new Date(),
    })
    .where(eq(leads.id, v.leadId));
  return true;
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const ok = await unsubscribe(token);
  // One-click senders want a 2xx; they don't render anything.
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const ok = await unsubscribe(token);
  const title = ok ? "Done — no more check-ins." : "That link is not valid.";
  const body = ok
    ? "We will not email you about this again. If you ever want your information deleted as well, just reply to any of our emails and ask."
    : "Reply to the email and we will take you off by hand.";
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#f6f7f4;font-family:Helvetica,Arial,sans-serif;">
<div style="max-width:520px;margin:0 auto;padding:64px 20px;">
  <p style="font-size:15px;font-weight:700;color:#15624a;margin:0 0 28px;">${EMAIL.brand}</p>
  <h1 style="font-size:24px;line-height:1.3;color:#131c18;margin:0 0 12px;">${title}</h1>
  <p style="font-size:16px;line-height:1.6;color:#3d4a44;margin:0;">${body}</p>
</div></body></html>`,
    { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex" } },
  );
}
