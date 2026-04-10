import { ArrowRight, Linkedin } from "lucide-react";

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
                At Krasa, we bring CTO-level thinking to brands that need expert
                tech guidance without the overhead of a full-time hire. From
                AI implementation to infrastructure, we've got you covered.
              </p>
              <a
                href="https://www.linkedin.com/in/abrahamclark/"
                target="_blank"
                rel="noopener noreferrer"
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
        </div>
      </div>
    </section>
  );
}
