import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { leads } from "@/db/schema";
import { verifyToken } from "@/lib/email/tokens";
import { outcomeLandingPage } from "@/lib/email/templates";
import { EMAIL } from "@/lib/email/config";
import { refreshLeadCard } from "@/lib/slack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ANSWERS = ["received", "waiting", "denied"] as const;
type Answer = (typeof ANSWERS)[number];

const html = (body: string, status = 200) =>
  new NextResponse(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex" },
  });

/**
 * One-click outcome capture.
 *
 *   GET /api/outcome/<token>?a=received|waiting|denied
 *
 * Recording on GET is a deliberate trade. The strictly correct thing is a POST
 * behind a confirmation button, because security scanners and link-preview
 * bots fetch every URL in an email and would otherwise answer on the
 * customer's behalf. But a question that takes two clicks gets answered far
 * less often, and this answer is the entire point of the follow-up sequence.
 *
 * So: we record on GET, and the page we return lets them change it in one more
 * click. A scanner's guess gets corrected by the human the moment they look.
 * We also keep every answer in `outcomeHistory`, so a corrected answer is
 * visible as a correction rather than silently overwriting the truth.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const answer = (req.nextUrl.searchParams.get("a") || "") as Answer;

  if (!ANSWERS.includes(answer)) {
    return html(page("That link is missing an answer.", "Use one of the buttons in the email."), 400);
  }

  const v = verifyToken(token, "outcome");
  if (!v.ok) {
    const msg =
      v.reason === "expired"
        ? "That link has expired."
        : "That link is not valid.";
    return html(page(msg, "Reply to the email instead and we will record it by hand."), 400);
  }

  const [lead] = await db.select().from(leads).where(eq(leads.id, v.leadId)).limit(1);
  if (!lead) {
    return html(page("We could not find that request.", "Reply to the email and we will sort it out."), 404);
  }

  const meta = (lead.meta ?? {}) as Record<string, unknown>;
  const history = Array.isArray(meta.outcomeHistory) ? (meta.outcomeHistory as unknown[]) : [];
  const recordedAt = new Date().toISOString();

  await db
    .update(leads)
    .set({
      meta: {
        ...meta,
        outcome: { answer, recordedAt },
        outcomeHistory: [...history, { answer, recordedAt }].slice(-10),
      },
      // A real answer is a real pipeline change: someone who got paid is won,
      // someone turned down is lost. This is the first thing that has ever
      // moved a lead off `new`.
      status: answer === "received" ? "won" : answer === "denied" ? "lost" : lead.status,
      updated_at: new Date(),
    })
    .where(eq(leads.id, v.leadId));

  // Edit the lead's Slack card, and say so in its thread — this is the
  // number the whole business is measured by.
  const [fresh] = await db.select().from(leads).where(eq(leads.id, v.leadId)).limit(1);
  if (fresh) {
    await refreshLeadCard(fresh, {
      text: answer === "received" ? "🎉 Refund received" : answer === "denied" ? "❌ Refund denied" : "⏳ Still waiting on refund",
      broadcast: answer !== "waiting",
    });
  }

  return html(
    outcomeLandingPage({
      answer,
      answerUrl: `${EMAIL.origin}/api/outcome/${token}`,
    }),
  );
}

function page(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#f6f7f4;font-family:Helvetica,Arial,sans-serif;">
<div style="max-width:520px;margin:0 auto;padding:64px 20px;">
  <p style="font-size:15px;font-weight:700;color:#15624a;margin:0 0 28px;">${EMAIL.brand}</p>
  <h1 style="font-size:24px;line-height:1.3;color:#131c18;margin:0 0 12px;">${title}</h1>
  <p style="font-size:16px;line-height:1.6;color:#3d4a44;margin:0;">${body}</p>
</div></body></html>`;
}
