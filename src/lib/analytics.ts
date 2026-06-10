/**
 * GA4 event tracking for the Krasa (krasadev.com) site.
 *
 * Pageviews are auto-tracked by <GoogleAnalytics gaId=... /> in
 * src/app/layout.tsx (same approach as krasa.ai and sunlightkids). This helper
 * just forwards custom events through @next/third-parties' sendGAEvent, keeping
 * the same `trackEvent(name, params)` signature the components already use.
 */
import { sendGAEvent } from "@next/third-parties/google";

export function trackEvent(
  name: string,
  params: Record<string, string | number | boolean | undefined> = {},
): void {
  sendGAEvent("event", name, params);
}
