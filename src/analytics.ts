/**
 * Google Analytics 4 (gtag.js) wrapper for the Krasa marketing site.
 *
 * The site is a single-page Vite + React app with anchor-based navigation
 * (#packages, #about, #contact). This module:
 *   1. Loads gtag.js asynchronously once at startup, using Google's canonical
 *      `function gtag(){dataLayer.push(arguments)}` shim so gtag.js recognizes
 *      queued commands (it checks for the `Arguments` shape and ignores
 *      plain Arrays — this caught us once with a rest-spread version).
 *   2. Fires one automatic page_view on load via the default `config` behavior.
 *   3. Fires an additional page_view on every `hashchange` so in-page nav
 *      shows up as distinct pageviews in GA reports.
 *   4. Exposes a typed `trackEvent()` helper for CTA clicks, form submissions,
 *      outbound links, etc.
 */

const MEASUREMENT_ID = "G-4DLFYNXNZZ";

declare global {
  interface Window {
    // gtag.js expects Arguments-like entries; we keep the type loose to match.
    dataLayer: IArguments[];
    gtag: (...args: unknown[]) => void;
  }
}

let initialized = false;

/**
 * Load gtag.js, bootstrap the dataLayer using the canonical shim, and wire
 * a hashchange listener that fires a virtual pageview per section.
 * Safe to call multiple times — only the first call does any work.
 */
export function initAnalytics(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  window.dataLayer = window.dataLayer || [];

  // IMPORTANT: push `arguments`, NOT a rest-spread array. gtag.js only
  // processes queued commands that are Arguments objects; plain Arrays are
  // ignored silently and no /g/collect beacons are ever sent. The `..._args`
  // parameter list is here only for TypeScript; the runtime reads the real
  // `arguments` object.
  function gtag(..._args: unknown[]): void {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;

  gtag("js", new Date());
  gtag("config", MEASUREMENT_ID);

  // Inject the gtag loader script.
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);

  // Treat hash changes as SPA navigation events. The initial pageview is
  // auto-sent by `gtag('config', ...)`.
  window.addEventListener("hashchange", () => {
    trackPageView();
  });
}

/**
 * Fire a GA4 `page_view` with the current URL. Called automatically on
 * every hashchange.
 */
export function trackPageView(overrides?: {
  page_title?: string;
  page_location?: string;
}): void {
  if (typeof window === "undefined" || !window.gtag) return;

  window.gtag("event", "page_view", {
    page_title: overrides?.page_title ?? document.title,
    page_location: overrides?.page_location ?? window.location.href,
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
  window.gtag("event", name, params);
}
