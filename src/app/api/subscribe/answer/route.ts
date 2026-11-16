import { NextRequest } from "next/server";
import { guard, preflight, readJson } from "@/lib/capture/http";
import { answer } from "@/lib/capture/service";
import { pgStore } from "@/lib/capture/pgStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/subscribe/answer  { token, question, answer } — the one-tap question. */
export async function POST(req: NextRequest) {
  const body = await readJson(req);
  return guard(req, "answer", () => answer(pgStore, body));
}

export const OPTIONS = preflight;
