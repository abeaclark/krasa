import { NextRequest, NextResponse } from "next/server";
import { pgStore } from "@/lib/capture/pgStore";
import { statusForEvent, verifySvix } from "@/lib/capture/resendWebhook";
import { brandForFrom } from "@/lib/email/brands";
import { normEmail } from "@/lib/capture/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Resend webhook: `email.bounced` → subscriber `bounced`, `email.complained`
 * → `complained`. Only the `subscribers` table is updated; leads are never
 * read or written. Requires RESEND_WEBHOOK_SECRET (the signing secret Resend
 * shows when the webhook is created) — without it every call is refused.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) return NextResponse.json({ ok: false, error: "Webhook is not configured" }, { status: 503 });

  const raw = await req.text();
  const ok = verifySvix(
    secret,
    {
      id: req.headers.get("svix-id"),
      timestamp: req.headers.get("svix-timestamp"),
      signature: req.headers.get("svix-signature"),
    },
    raw,
  );
  if (!ok) return NextResponse.json({ ok: false, error: "Bad signature" }, { status: 401 });

  let evt: { type?: unknown; data?: { to?: unknown; from?: unknown } };
  try {
    evt = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const status = statusForEvent(evt.type);
  if (!status) return NextResponse.json({ ok: true, ignored: true });

  const to = Array.isArray(evt.data?.to) ? evt.data!.to : [evt.data?.to];
  const site = brandForFrom(typeof evt.data?.from === "string" ? evt.data.from : null)?.site ?? null;
  try {
    let changed = 0;
    for (const addr of to) {
      const email = normEmail(addr);
      if (email) changed += await pgStore.setStatusByEmail(email, status, site);
    }
    return NextResponse.json({ ok: true, changed });
  } catch (err) {
    console.error("[webhooks/resend] failed", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
