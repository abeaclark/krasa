import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { leads } from "@/db/schema";

type Lead = typeof leads.$inferSelect;

/**
 * Which of someone's leads is "their kit". People re-run the funnel, so one
 * email can have several: prefer the one they paid on, then the one that got
 * furthest, then the newest.
 */
export async function bestLeadForEmail(site: string, email: string): Promise<Lead | null> {
  const rows = await db
    .select()
    .from(leads)
    .where(and(eq(leads.site, site), sql`lower(${leads.email}) = ${email.toLowerCase()}`))
    .orderBy(desc(leads.created_at))
    .limit(10);
  if (!rows.length) return null;
  const score = (l: Lead) => {
    const m = (l.meta ?? {}) as Record<string, unknown>;
    const stages = Array.isArray(m._stages) ? m._stages.length : 0;
    return (m.purchase ? 1000 : 0) + stages;
  };
  return rows.reduce((best, l) => (score(l) > score(best) ? l : best), rows[0]);
}

/** Meta keys that are ours, not the customer's answers. */
const INTERNAL = new Set(["emails", "outcome", "outcomeHistory", "emailUnsubscribedAt", "contactConsent", "restore"]);

export function publicMeta(meta: unknown): Record<string, unknown> {
  const m = (meta ?? {}) as Record<string, unknown>;
  return Object.fromEntries(Object.entries(m).filter(([k]) => !INTERNAL.has(k)));
}
