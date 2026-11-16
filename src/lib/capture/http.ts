import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "@/lib/leads-intake";
import type { Reply } from "./service";

/** Body as JSON whatever the content type — sendBeacon posts text/plain. */
export async function readJson(req: NextRequest): Promise<unknown> {
  try {
    return JSON.parse(await req.text());
  } catch {
    return null;
  }
}

export function send(req: NextRequest, r: Reply): NextResponse {
  return NextResponse.json(r.body, { status: r.status, headers: corsHeaders(req.headers.get("origin")) });
}

export function preflight(req: NextRequest): NextResponse {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

/** Wrap a handler so a database failure is a 500 JSON, never an unhandled throw. */
export async function guard(req: NextRequest, tag: string, fn: () => Promise<Reply>): Promise<NextResponse> {
  try {
    return send(req, await fn());
  } catch (err) {
    console.error(`[capture/${tag}] failed`, err);
    return send(req, { status: 500, body: { ok: false, error: "Server error" } });
  }
}
