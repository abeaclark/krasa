import { ArrowRight } from "lucide-react";
import { trackEvent } from "../analytics";

export function Hero() {
  return (
    <section className="bg-accent pt-20 pb-24">
      <div className="max-w-[900px] mx-auto px-6 text-center">
        <div className="inline-flex items-center gap-1.5 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest rounded-full bg-accent-dark/10 text-accent-dark mb-10">
          CTO-level expertise, on demand
        </div>

        <h1
          className="uppercase leading-[0.95] tracking-[0.02em] text-accent-dark mb-7"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(48px,7vw,88px)",
          }}
        >
          Tech is costing <br/> your brand $$
        </h1>

        <p className="text-[18px] leading-relaxed text-accent-dark/65 max-w-[520px] mx-auto mb-10 font-medium">
          Outsource technology & AI implementation <br/> to Krasa's CTO-level experts
        </p>

        <div className="flex gap-3 justify-center flex-wrap">
          <a
            href="#packages"
            onClick={() =>
              trackEvent("cta_click", {
                cta_label: "See Our Packages",
                cta_location: "hero_primary",
                cta_target: "#packages",
              })
            }
            className="inline-flex items-center gap-2 px-8 py-4 bg-accent-dark text-white font-bold text-base rounded-full no-underline hover:opacity-90 transition-all active:scale-[0.97]"
          >
            See Our Packages <ArrowRight className="w-4 h-4" />
          </a>
          <a
            href="#contact"
            onClick={() =>
              trackEvent("cta_click", {
                cta_label: "Get in Touch",
                cta_location: "hero_secondary",
                cta_target: "#contact",
              })
            }
            className="inline-flex items-center gap-2 px-8 py-4 bg-transparent border border-accent-dark/20 text-accent-dark font-semibold text-base rounded-full no-underline hover:border-accent-dark/40 transition-all"
          >
            Get in Touch
          </a>
        </div>
      </div>
    </section>
  );
}
