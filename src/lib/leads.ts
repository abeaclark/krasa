/**
 * Browser-side helper for krasadev's own forms to submit a lead.
 *
 * Posts to the same-origin /api/leads by default (override with
 * NEXT_PUBLIC_LEADS_ENDPOINT). Other sites use their own copy of this helper
 * pointed at https://krasadev.com/api/leads — see docs/leads-backend.md.
 */
const ENDPOINT = process.env.NEXT_PUBLIC_LEADS_ENDPOINT || "/api/leads";

const SITE = "krasadev.com";

export interface SubmitLeadInput {
  source?: string;
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  meta?: Record<string, unknown>;
  /** Honeypot value — wire to a hidden field; real users leave it empty. */
  hp?: string;
}

export interface SubmitLeadResult {
  ok: boolean;
  id?: string | null;
  error?: string;
}

export async function submitLead(
  input: SubmitLeadInput,
): Promise<SubmitLeadResult> {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site: SITE, ...input }),
    });
    const data = (await res.json().catch(() => ({}))) as SubmitLeadResult;
    if (!res.ok) {
      return { ok: false, error: data.error || `Request failed (${res.status})` };
    }
    return { ok: true, id: data.id ?? null };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}
