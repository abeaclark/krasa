/**
 * Code enums for the shared leads backend.
 *
 * These are intentionally NOT Postgres enums. Keeping them in code (per the
 * wonderful-app convention of `varchar(...).$type<SomeT>()`) means we can add,
 * rename, or reorder statuses without a database migration — the column stays a
 * plain `varchar` and the type system enforces the allowed values.
 */

// Lifecycle of a lead once it lands. `new` is the default on intake.
export const LEAD_STATUSES = [
  "new", // just arrived, not yet looked at
  "contacted", // we've reached out
  "qualified", // real opportunity worth pursuing
  "won", // converted
  "lost", // didn't convert
  "spam", // junk / bot
] as const;

export type LeadStatusT = (typeof LEAD_STATUSES)[number];

export const DEFAULT_LEAD_STATUS: LeadStatusT = "new";

export function isLeadStatus(value: unknown): value is LeadStatusT {
  return (
    typeof value === "string" &&
    (LEAD_STATUSES as readonly string[]).includes(value)
  );
}

// The sites allowed to post leads. Used for attribution + CORS allow-listing.
// `localhost` entries let each site's dev server post during local development.
export const SITES = [
  "krasadev.com",
  "krasa.ai",
  "localservicegroup.com",
  "refundauto.com",
  "sunlightkids.com",
] as const;

export type SiteT = (typeof SITES)[number];

export function isKnownSite(value: unknown): value is SiteT {
  return (
    typeof value === "string" && (SITES as readonly string[]).includes(value)
  );
}
