import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Resend signs webhooks with Svix: HMAC-SHA256 over `${id}.${timestamp}.${body}`
 * under the base64 secret that follows the `whsec_` prefix. The signature
 * header is a space-separated list of `v1,<base64>` entries.
 */
export function verifySvix(
  secret: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  body: string,
  nowMs = Date.now(),
): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowMs / 1000 - ts) > 300) return false; // replay window
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();
  return signature.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) return false;
    const given = Buffer.from(sig, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

/** What a Resend event means for the subscriber list, if anything. */
export function statusForEvent(type: unknown): "bounced" | "complained" | null {
  if (type === "email.bounced") return "bounced";
  if (type === "email.complained") return "complained";
  return null;
}
