import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { leads } from "@/db/schema";
import type { StoredDocument } from "@/lib/storage";

/** Cap so a malicious or looping client can't grow a lead's meta unbounded. */
export const MAX_DOCS_PER_LEAD = 10;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function cleanRef(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return UUID_RE.test(t) ? t : null;
}

/**
 * Attach stored-document descriptors to a lead's `meta.documents`.
 *
 * Idempotent by object path: the funnel may retry, and the same file should
 * never appear twice. Silently no-ops when the lead doesn't exist — the object
 * itself is already safe in the bucket and the path contains the ref, so a lost
 * pointer is recoverable.
 */
export async function appendDocuments(
  leadId: string,
  incoming: StoredDocument[],
): Promise<{ attached: number }> {
  if (incoming.length === 0) return { attached: 0 };

  const [existing] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!existing) return { attached: 0 };

  const meta = (existing.meta ?? {}) as Record<string, unknown>;
  const current = Array.isArray(meta.documents) ? (meta.documents as StoredDocument[]) : [];
  const seen = new Set(current.map((d) => d.path));

  const added = incoming.filter((d) => d.path && !seen.has(d.path));
  if (added.length === 0) return { attached: 0 };

  const next = [...current, ...added].slice(0, MAX_DOCS_PER_LEAD);

  await db
    .update(leads)
    .set({
      meta: { ...meta, documents: next, uploadedDocs: next.length > 0 },
      updated_at: new Date(),
    })
    .where(eq(leads.id, leadId));

  return { attached: added.length };
}

/**
 * Trust boundary: descriptors arrive from the browser after a direct-to-storage
 * upload, so treat every field as untrusted. We keep only the shape we need and
 * verify the path is inside the ref's own folder — a client can't claim a file
 * belonging to a different lead.
 */
export function sanitizeDocument(
  raw: unknown,
  allowedPrefixes: string[],
): StoredDocument | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;

  const path = typeof d.path === "string" ? d.path.trim() : "";
  if (!path || path.includes("..")) return null;
  if (!allowedPrefixes.some((p) => path.startsWith(p))) return null;

  return {
    path: path.slice(0, 500),
    name: typeof d.name === "string" ? d.name.trim().slice(0, 200) : "document",
    size: typeof d.size === "number" && Number.isFinite(d.size) ? d.size : 0,
    contentType:
      typeof d.contentType === "string"
        ? d.contentType.slice(0, 100)
        : "application/octet-stream",
    uploadedAt:
      typeof d.uploadedAt === "string" ? d.uploadedAt.slice(0, 40) : new Date().toISOString(),
  };
}
