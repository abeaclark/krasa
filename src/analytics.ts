/**
 * Google Analytics 4 (gtag.js) wrapper for the Krasa marketing site.
 *
 * The site is a single-page Vite + React app with anchor-based navigation
 * (#packages, #about, #contact). This module:
 *   1. Loads gtag.js asynchronously once at startup.
 *   2. Disables gtag's automatic pageview and fires one manually on load.
 *   3. Fires an additional page_view on every `hashchange` so in-page nav
 *      shows up as distinct pageviews in GA reports.
 *   4. Exposes a typed `trackEvent()` helper used by components for
 *      CTA clicks, form submissions, outbound links, etc.
 */

const MEASUREMENT_ID = "G-4DLFYNXNZZ";

type GtagCommand = "config" | "event" | "set" | "js" | "consent";
type GtagArgs = [GtagCommand, ...unknown[]];

declare global {
  interface Window {
    dataLayer: GtagArgs[];
    gtag: (...args: GtagArgs) => void;
  }
}

let initialized = false;

/**
 * Load gtag.js, bootstrap the dataLayer, fire the initial pageview, and
 * wire up a hashchange listener that fires a virtual pageview per section.
 * Safe to call multiple times — only the first call does any work.
 */
export function initAnalytics(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  // Bootstrap dataLayer + gtag shim before the script loads so queued calls
  // survive. This matches Google's official install snippet.
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: GtagArgs) {
    window.dataLayer.push(args);
  };
  window.gtag("js", new Date());

  // Disable the automatic initial pageview — we send it manually with the
  // resolved page_location so hash-based routes are handled consistently.
  window.gtag("config", MEASUREMENT_ID, { send_page_view: false });

  // Inject the gtag loader script.
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);

  // Initial pageview.
  trackPageView();

  // Treat hash changes as SPA navigation events.
  window.addEventListener("hashchange", () => {
    trackPageView();
  });
}

/**
 * Fire a GA4 `page_view` with the current URL. Called automatically on load
 * and on every hashchange.
 */
export function trackPageView(overrides?: {
  page_title?: string;
  page_location?: string;
  page_path?: string;
}): void {
  if (typeof window === "undefined" || !window.gtag) return;

  const page_location = overrides?.page_location ?? window.location.href;
  const page_path =
    overrides?.page_path ??
    window.location.pathname + window.location.search + window.location.hash;
  const page_title = overrides?.page_title ?? document.title;

  window.gtag("event", "page_view", {
    page_location,
    page_path,
    page_title,
    send_to: MEASUREMENT_ID,
  });
}

/**
 * Fire a custom GA4 event. Params should be a flat object of scalars.
 * Examples:
 *   trackEvent("cta_click", { cta_label: "Get in Touch", cta_location: "header" });
 *   trackEvent("generate_lead", { form_location: "contact_section" });
 */
export function trackEvent(
  name: string,
  params: Record<string, string | number | boolean | undefined> = {},
): void {
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", name, { ...params, send_to: MEASUREMENT_ID });
}
