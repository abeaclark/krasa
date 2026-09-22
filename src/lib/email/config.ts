/**
 * Email identity and the addresses that appear in every message.
 *
 * The postal address is not optional decoration: CAN-SPAM (15 U.S.C. 7704(a)(5))
 * requires a valid physical postal address in commercial email, and a message
 * without one is a violation per message sent.
 */
export const EMAIL = {
  /** Envelope sender. A subdomain, so a deliverability problem here can never
   *  damage the apex domain's reputation for anything else. */
  from: "RefundAuto <hello@mail.refundauto.com>",
  replyTo: "support@refundauto.com",
  brand: "RefundAuto",
  legalName: "Krasa Development, LLC",
  postalAddress: "PO Box 186, Hanalei, HI 96714",
  /**
   * Where one-click links point.
   *
   * The customer-facing domain, NOT this API's origin: a RefundAuto email
   * whose buttons lead to krasadev.com reads as phishing, which is the one
   * thing a message asking someone to click must never look like. That site
   * proxies /api/outcome and /api/unsubscribe straight back here.
   */
  origin: process.env.EMAIL_LINK_ORIGIN?.replace(/\/+$/, "") || "https://www.refundauto.com",
  /** The customer-facing site, for "back to the site" links. */
  siteUrl: "https://www.refundauto.com",
} as const;

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY?.trim();
}
