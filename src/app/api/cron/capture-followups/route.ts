import { NextRequest, NextResponse } from "next/server";
import { pgStore } from "@/lib/capture/pgStore";
import { runFollowups } from "@/lib/capture/followups";
import { sendBrandEmail } from "@/lib/email/brandSend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Popup follow-ups, every 30 minutes (vercel.json): the sequence steps that
 * have fallen due and any seasonal campaign in its send window. Popup
 * subscribers only (`subscribers`); never reads or writes `leads`.
 * See src/lib/capture/followups.ts.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const summary = await runFollowups(pgStore, sendBrandEmail);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[cron/capture-followups] failed", err);
    return NextResponse.json({ ok: false, error: "Follow-ups failed" }, { status: 500 });
  }
}
