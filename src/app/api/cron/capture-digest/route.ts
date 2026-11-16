import { NextRequest, NextResponse } from "next/server";
import { pgStore } from "@/lib/capture/pgStore";
import { buildDigest } from "@/lib/capture/digest";
import { hstYesterday } from "@/lib/capture/core";
import { postSlackText } from "@/lib/slack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily popup digest → Slack, 7:00 HST (17:00 UTC, see vercel.json).
 *
 * One message covering yesterday (Pacific/Honolulu) for every site. Reads
 * capture_stats_daily only; sends no email and touches no lead. Posts nothing
 * on a day with no popup activity.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const day = hstYesterday();
    const text = buildDigest(day, await pgStore.stats(day, day));
    if (!text) return NextResponse.json({ ok: true, day, posted: false });
    const posted = await postSlackText(process.env.SLACK_CAPTURE_CHANNEL?.trim() || null, text);
    return NextResponse.json({ ok: true, day, posted });
  } catch (err) {
    console.error("[cron/capture-digest] failed", err);
    return NextResponse.json({ ok: false, error: "Digest failed" }, { status: 500 });
  }
}
