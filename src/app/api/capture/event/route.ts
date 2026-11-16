import { NextRequest } from "next/server";
import { guard, preflight, readJson } from "@/lib/capture/http";
import { event } from "@/lib/capture/service";
import { pgStore } from "@/lib/capture/pgStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/capture/event  { site, offer, event: view|close|click, device }
 *
 * Increments today's counter (Pacific/Honolulu day) in capture_stats_daily.
 * Accepts text/plain bodies, because navigator.sendBeacon sends those.
 */
export async function POST(req: NextRequest) {
  const body = await readJson(req);
  return guard(req, "event", () => event(pgStore, body));
}

export const OPTIONS = preflight;
