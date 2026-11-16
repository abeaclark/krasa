import { NextRequest } from "next/server";
import { guard, preflight, readJson } from "@/lib/capture/http";
import { assign } from "@/lib/capture/service";
import { pgStore } from "@/lib/capture/pgStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/capture/assign  { site, offers: string[] }  →  { ok, offer }
 *
 * Round robin for the email-capture popup: returns the listed offer that has
 * been handed out the fewest times (ties by list order) and counts it.
 */
export async function POST(req: NextRequest) {
  const body = await readJson(req);
  return guard(req, "assign", () => assign(pgStore, body));
}

export const OPTIONS = preflight;
