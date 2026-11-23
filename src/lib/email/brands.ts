import type { SiteT } from "@/lib/enums";

/**
 * Per-brand email identity for the popup reward emails.
 *
 * Every brand sends from its own `mail.<domain>` subdomain (so a deliverability
 * problem can never hurt the apex) and every link points at the brand's own
 * site — a Sunlight Kids email whose button leads to krasadev.com reads as
 * phishing. Each site proxies /api/subscribe/unsubscribe/<token> back here.
 *
 * The postal address is required by CAN-SPAM in every commercial email.
 */
export interface Brand {
  site: string;
  name: string;
  /** Wordmark at the top of the email. */
  logoText: string;
  from: string;
  replyTo: string;
  primary: string;
  /** Customer-facing origin for every link. */
  origin: string;
  legalName: string;
  postalAddress: string;
  privacyUrl: string;
}

const LEGAL_NAME = "Krasa Development, LLC";
const POSTAL_ADDRESS = "PO Box 186, Hanalei, HI 96714";

/**
 * `sendDomain` is the Resend-verified domain mail goes out from. Default
 * `mail.<domain>`; a brand whose Resend account only has the apex verified
 * passes the apex instead.
 */
function brand(domain: string, name: string, primary: string, replyTo?: string, sendDomain = `mail.${domain}`): Brand {
  const origin = `https://www.${domain}`;
  return {
    site: domain,
    name,
    logoText: name,
    from: `${name} <hello@${sendDomain}>`,
    replyTo: replyTo ?? `hello@${domain}`,
    primary,
    origin,
    legalName: LEGAL_NAME,
    postalAddress: POSTAL_ADDRESS,
    privacyUrl: `${origin}/privacy`,
  };
}

export const BRANDS: Partial<Record<SiteT, Brand>> = {
  "refundauto.com": brand("refundauto.com", "RefundAuto", "#3f51d1", "support@refundauto.com"),
  // Only the apex is verified in the krasadev Resend account (Nov 23): popup
  // mail sent from mail.sunlightkids.com was rejected. Move to mail. once that
  // subdomain is verified there.
  "sunlightkids.com": brand("sunlightkids.com", "Sunlight Kids", "#e00b41", undefined, "sunlightkids.com"),
  "lessonsupply.com": brand("lessonsupply.com", "LessonSupply", "#2f4a3e"),
  "practicetesthq.com": brand("practicetesthq.com", "PracticeTestHQ", "#0b6e4f"),
  "teacherexamhq.com": brand("teacherexamhq.com", "TeacherExamHQ", "#0b6e4f"),
  "realestateexamhq.com": brand("realestateexamhq.com", "RealEstateExamHQ", "#1d4e89"),
  "solvedparty.com": brand("solvedparty.com", "SolvedParty", "#2a1838"),
  "sunday101.com": brand("sunday101.com", "Sunday101", "#1E2A3A"),
};

export function brandFor(site: string): Brand | null {
  return (BRANDS as Record<string, Brand | undefined>)[site] ?? null;
}

/** The brand whose sending address appears in a From header, if any. */
export function brandForFrom(from: string | null | undefined): Brand | null {
  if (!from) return null;
  const m = from.toLowerCase().match(/@(?:mail\.)?([a-z0-9.-]+)/);
  return m ? brandFor(m[1]) : null;
}

/**
 * Turn a link sent by a site into an absolute URL on that brand's own domain.
 * Anything pointing elsewhere is refused: this endpoint sends mail, so it must
 * not be usable to email someone an arbitrary link under a brand's name.
 */
export function brandUrl(b: Brand, href: string | null | undefined): string | null {
  if (!href) return null;
  try {
    const u = new URL(href, b.origin);
    const host = u.hostname.toLowerCase();
    if (u.protocol !== "https:" || (host !== b.site && host !== `www.${b.site}`)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function unsubscribeUrl(b: Brand, token: string): string {
  return `${b.origin}/api/subscribe/unsubscribe/${token}`;
}
