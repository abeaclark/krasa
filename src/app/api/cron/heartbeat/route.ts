import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { heartbeats } from "@/db/schema";

// postgres-js needs the Node runtime (not edge).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily keep-alive endpoint.
 *
 *   GET /api/cron/heartbeat
 *
 * Triggered by the Vercel cron defined in vercel.json. It writes one row to the
 * `heartbeats` table so Supabase sees regular DB activity and won't pause the
 * free-tier project.
 *
 * Auth: when CRON_SECRET is set, Vercel sends `Authorization: Bearer <secret>`
 * on cron invocations. We require it so the endpoint can't be spammed publicly.
 * If CRON_SECRET is unset (e.g. local dev) the check is skipped.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const [inserted] = await db
      .insert(heartbeats)
      .values({
        source: "vercel-cron",
        meta: { region: process.env.VERCEL_REGION ?? null },
      })
      .returning();

    return NextResponse.json({
      ok: true,
      id: inserted.id,
      at: inserted.created_at,
    });
  } catch (err) {
    console.error("[cron/heartbeat] failed to write heartbeat", err);
    return NextResponse.json(
      { ok: false, error: "Failed to write heartbeat" },
      { status: 500 },
    );
  }
}
