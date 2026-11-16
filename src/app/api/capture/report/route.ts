import { NextRequest, NextResponse } from "next/server";
import { pgStore } from "@/lib/capture/pgStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/capture/report?since=YYYY-MM-DD   (Authorization: Bearer CAPTURE_REPORT_SECRET)
 *
 * Read-only feed for the portfolio dashboard: every capture_stats_daily row
 * since the date, plus subscriber counts by site and status. No emails.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CAPTURE_REPORT_SECRET?.trim();
  if (!secret) return NextResponse.json({ ok: false, error: "Report is not configured" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const since = req.nextUrl.searchParams.get("since") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) {
    return NextResponse.json({ ok: false, error: "since must be YYYY-MM-DD" }, { status: 400 });
  }
  try {
    const [stats, subscribers] = await Promise.all([pgStore.stats(since), pgStore.subscriberCounts()]);
    return NextResponse.json({ ok: true, since, stats, subscribers });
  } catch (err) {
    console.error("[capture/report] failed", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
