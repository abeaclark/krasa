"use client";

import { ArrowRight } from "lucide-react";
import { PastSuccesses } from "./PastSuccesses";
import { trackEvent } from "@/lib/analytics";

// Brand/social icons were removed from lucide-react v1, so the LinkedIn glyph
// is inlined here.
function Linkedin({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

export function About() {
  return (
    <section id="about" className="py-24">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-2 text-xs font-bold tracking-[0.06em] uppercase text-accent-dark/50 mb-3">
            Who We Are
          </div>
          <h2
            className="uppercase tracking-[0.03em] leading-[1.0] text-ink"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(32px,4vw,52px)",
            }}
          >
            Built by founders, for founders
          </h2>
        </div>

        <div className="max-w-[900px] mx-auto">
          <div className="flex flex-col md:flex-row gap-10 items-start bg-surface rounded-2xl border border-ink/[0.07] p-8 md:p-10 shadow-[0_1px_3px_rgba(14,15,12,0.04),0_4px_12px_rgba(14,15,12,0.02)]">
            <img
              src="/abe1.jpeg"
              alt="Abe Clark"
              className="w-28 h-28 md:w-36 md:h-36 rounded-2xl object-cover shrink-0"
            />
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-ink tracking-tight mb-1">
                Abe Clark
              </h3>
              <p className="text-sm font-semibold text-accent-dark mb-4">
                Founder & CEO
              </p>
              <p className="text-[15px] text-muted leading-relaxed mb-4">
                Abe has spent his career at the intersection of technology and
                business — building products, leading engineering teams, and
                advising companies on how to leverage technology for growth. He
                has assembled a team around him of experienced technologists and
                former founders who understand what it takes to build, scale, and
                ship.
              </p>
              <p className="text-[15px] text-muted leading-relaxed mb-6">
                At Krasa, we bring CTO-level execution to brands that need expert
                tech guidance without the overhead of a full-time hire. From
                AI implementation to infrastructure, we've got you covered.
              </p>
              <a
                href="https://www.linkedin.com/in/abrahamclark/"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  trackEvent("outbound_click", {
                    link_domain: "linkedin.com",
                    link_url: "https://www.linkedin.com/in/abrahamclark/",
                    link_label: "Connect on LinkedIn",
                    link_location: "about_section",
                  })
                }
                className="inline-flex items-center gap-2 text-sm font-semibold text-accent-dark no-underline hover:text-accent-dark/80 transition-colors"
              >
                <Linkedin className="w-4 h-4" /> Connect on LinkedIn{" "}
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-1 gap-5 mt-8">
            <div className="bg-surface rounded-2xl border border-ink/[0.07] p-7 text-center shadow-[0_1px_3px_rgba(14,15,12,0.04),0_4px_12px_rgba(14,15,12,0.02)]">
              <div
                className="text-ink tracking-tight mb-1"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(32px,3vw,44px)",
                }}
              >
                10+
              </div>
              <div className="text-sm text-muted font-medium">
                Years in tech leadership
              </div>
            </div>
          </div>

          <PastSuccesses />
        </div>
      </div>
    </section>
  );
}
