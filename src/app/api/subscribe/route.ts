import { NextRequest } from "next/server";
import { guard, preflight, readJson, send } from "@/lib/capture/http";
import { subscribe } from "@/lib/capture/service";
import { pgStore } from "@/lib/capture/pgStore";
import { sendBrandEmail } from "@/lib/email/brandSend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/subscribe — a popup signup (body: SPEC §7).
 *
 * Upserts the subscriber (one row per site + email), counts the signup, sends
 * the reward email and returns { ok, token }. Writes to `subscribers` only —
 * never `leads`, so no drip email and no Slack ping.
 *
 * This route sends mail, so when CAPTURE_PROXY_SECRET is set it only accepts
 * calls carrying it (the sites' server-side proxies send it; browsers can't).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CAPTURE_PROXY_SECRET?.trim();
  if (secret && req.headers.get("x-capture-secret") !== secret) {
    return send(req, { status: 401, body: { ok: false, error: "Unauthorized" } });
  }
  const body = await readJson(req);
  return guard(req, "subscribe", () => subscribe(pgStore, body, sendBrandEmail));
}

export const OPTIONS = preflight;
