import { SITES, isKnownSite } from "@/lib/enums";

/**
 * The wire format every site POSTs to /api/leads.
 *
 * Only `site` is strictly required, plus at least one way to reach the person
 * (email or phone). Everything else is optional; arbitrary extra fields can be
 * passed under `meta`.
 */
export interface LeadIntakePayload {
  site?: string;
  source?: string;
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  meta?: Record<string, unknown>;
  // Honeypot: real users never fill this. Bots usually do.
  hp?: string;
}

export interface NormalizedLead {
  site: string;
  source: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  meta: Record<string, unknown>;
}

export type IntakeResult =
  | { ok: true; lead: NormalizedLead; isSpam: boolean }
  | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(v: unknown, max = 2000): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

/**
 * Validate + normalize an incoming payload into a row we can insert.
 * Returns `isSpam` (honeypot tripped) so the caller can still 200 the bot while
 * tagging the row — never tell a bot it failed.
 */
export function normalizeLead(input: LeadIntakePayload): IntakeResult {
  const site = clean(input.site, 100);
  if (!site) return { ok: false, error: "Missing required field: site" };

  const email = clean(input.email, 320);
  const phone = clean(input.phone, 50);
  const name = clean(input.name, 200);

  if (!email && !phone && !name) {
    return { ok: false, error: "A lead needs at least a name, email, or phone" };
  }
  if (email && !EMAIL_RE.test(email)) {
    return { ok: false, error: "Invalid email address" };
  }

  const meta =
    input.meta && typeof input.meta === "object" && !Array.isArray(input.meta)
      ? (input.meta as Record<string, unknown>)
      : {};

  const isSpam = typeof input.hp === "string" && input.hp.trim().length > 0;

  return {
    ok: true,
    isSpam,
    lead: {
      site,
      source: clean(input.source, 120),
      name,
      email,
      phone,
      message: clean(input.message, 5000),
      meta,
    },
  };
}

// ---- CORS ---------------------------------------------------------------

// Allow the known production sites (www + apex) plus any localhost port for dev.
const ALLOWED_ORIGINS = new Set<string>(
  SITES.flatMap((s) => [`https://${s}`, `https://www.${s}`]),
);

export function resolveCorsOrigin(origin: string | null): string | null {
  if (!origin) return null;
  if (ALLOWED_ORIGINS.has(origin)) return origin;
  try {
    const { hostname } = new URL(origin);
    if (hostname === "localhost" || hostname === "127.0.0.1") return origin;
    // Vercel preview deploys of any of these projects.
    if (hostname.endsWith(".vercel.app")) return origin;
  } catch {
    return null;
  }
  return null;
}

export function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = resolveCorsOrigin(origin);
  return {
    "Access-Control-Allow-Origin": allowed ?? "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export { isKnownSite };
