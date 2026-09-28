import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed, stateless links for email.
 *
 * Follow-up emails ask a question ("did your refund arrive?") and we want the
 * answer to cost exactly one click — no login, no code to paste, no form. That
 * means the link itself has to carry the identity, and it has to be
 * unforgeable, because the same mechanism could otherwise be used to write
 * outcomes onto anyone's lead by guessing a UUID.
 *
 * A token is `<payload>.<signature>`:
 *   payload   base64url JSON { l: leadId, p: purpose, e: expiry (unix seconds) }
 *   signature base64url HMAC-SHA256 of the payload under EMAIL_TOKEN_SECRET
 *
 * Stateless on purpose: nothing to store, nothing to clean up, and a token
 * stops working on its own. The cost is that a token cannot be revoked early,
 * which is why the payload carries no personal data and the purposes are
 * narrow — recording an outcome, or unsubscribing.
 */

/**
 * "restore" opens someone's cancellation kit on a new device. It carries no
 * personal data and only works for the lead it names — possession of the
 * link is the proof that you own the inbox it was sent to.
 */
export type TokenPurpose = "outcome" | "unsubscribe" | "restore";

const DEFAULT_TTL_DAYS = 180;

function secret(): string | null {
  const s = process.env.EMAIL_TOKEN_SECRET?.trim();
  return s && s.length >= 16 ? s : null;
}

/** True when tokens can be minted and verified at all. */
export function tokensConfigured(): boolean {
  return secret() !== null;
}

const b64url = (b: Buffer) => b.toString("base64url");

function sign(payload: string, key: string): string {
  return b64url(createHmac("sha256", key).update(payload).digest());
}

export function createToken(
  leadId: string,
  purpose: TokenPurpose,
  ttlDays = DEFAULT_TTL_DAYS,
): string | null {
  const key = secret();
  if (!key) return null;
  const payload = b64url(
    Buffer.from(
      JSON.stringify({
        l: leadId,
        p: purpose,
        e: Math.floor(Date.now() / 1000 + ttlDays * 86400),
      }),
    ),
  );
  return `${payload}.${sign(payload, key)}`;
}

export type VerifiedToken =
  | { ok: true; leadId: string; purpose: TokenPurpose }
  | { ok: false; reason: "unconfigured" | "malformed" | "bad-signature" | "expired" };

export function verifyToken(token: string, expected: TokenPurpose): VerifiedToken {
  const key = secret();
  if (!key) return { ok: false, reason: "unconfigured" };

  const dot = token.lastIndexOf(".");
  if (dot <= 0) return { ok: false, reason: "malformed" };
  const payload = token.slice(0, dot);
  const provided = token.slice(dot + 1);

  // Constant-time compare so the signature can't be brute-forced a byte at a
  // time by measuring how long the rejection takes.
  const expectedSig = Buffer.from(sign(payload, key));
  const providedSig = Buffer.from(provided);
  if (
    expectedSig.length !== providedSig.length ||
    !timingSafeEqual(expectedSig, providedSig)
  ) {
    return { ok: false, reason: "bad-signature" };
  }

  let parsed: { l?: unknown; p?: unknown; e?: unknown };
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (typeof parsed.l !== "string" || parsed.p !== expected) {
    return { ok: false, reason: "malformed" };
  }
  if (typeof parsed.e !== "number" || parsed.e < Math.floor(Date.now() / 1000)) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, leadId: parsed.l, purpose: expected };
}
