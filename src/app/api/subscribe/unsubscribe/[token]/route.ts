import { NextRequest, NextResponse } from "next/server";
import { unsubscribe } from "@/lib/capture/service";
import { pgStore } from "@/lib/capture/pgStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Unsubscribe a popup subscriber.
 *
 *   GET  — the visible footer link. Each brand's site proxies it here and
 *          renders its own "You're unsubscribed" page from this JSON.
 *   POST — RFC 8058 one-click, called by the mail client itself.
 *
 * Both act immediately and are idempotent. Nothing is deleted.
 */
async function run(ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  try {
    const r = await unsubscribe(pgStore, token);
    return NextResponse.json(r.body, { status: r.status, headers: { "X-Robots-Tag": "noindex" } });
  } catch (err) {
    console.error("[capture/unsubscribe] failed", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  return run(ctx);
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  return run(ctx);
}
