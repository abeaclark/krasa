import { ArrowRight, Check } from "lucide-react";

const packages = [
  {
    name: "Keep the Lights On",
    price: "$3,000",
    description:
      "Essential tech support to keep your business running smoothly.",
    features: [
      "Async Slack support",
      "Account and IT organization",
      "Basic Software integration",
      "Basic Software migration",
      "Basic debugging / fixes",
    ],
    highlighted: false,
  },
  {
    name: "Grow",
    price: "$6,000",
    description:
      "Everything you need to optimize and scale your digital presence.",
    features: [
      'Everything in "Keep the Lights On"',
      "Sitespeed optimizations and CRO",
      "Landing page buildouts",
      "AI implementation advisory",
      "Basic infrastructure setup and maintenance",
    ],
    highlighted: true,
  },
  {
    name: "Conquer",
    price: "$10,000",
    description:
      "Full-spectrum tech leadership for ambitious brands ready to dominate.",
    features: [
      "Everything in Grow",
      "Custom AI implementation / infrastructure",
      "Major migrations",
      "Employee AI training",
    ],
    highlighted: false,
  },
];

export function Packages() {
  return (
    <section id="packages" className="pt-24 pb-28 bg-surface">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-2 text-xs font-bold tracking-[0.06em] uppercase text-accent-dark/50 mb-3">
            Packages
          </div>
          <h2
            className="uppercase tracking-[0.03em] leading-[1.0] text-ink"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(32px,4vw,52px)",
            }}
          >
            Choose your level of support
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {packages.map((pkg) => (
            <div
              key={pkg.name}
              className={`relative flex flex-col rounded-2xl border p-8 transition-all ${
                pkg.highlighted
                  ? "border-accent bg-accent/[0.06] shadow-[0_4px_24px_rgba(159,232,112,0.12)]"
                  : "border-ink/[0.07] bg-surface shadow-[0_1px_3px_rgba(14,15,12,0.04),0_4px_12px_rgba(14,15,12,0.02)]"
              }`}
            >
              {pkg.highlighted && (
                <div className="absolute -top-3.5 left-8 px-4 py-1 text-[11px] font-bold uppercase tracking-widest rounded-full bg-accent text-accent-dark">
                  Most Popular
                </div>
              )}

              <h3 className="text-xl font-bold text-ink tracking-tight mb-2">
                {pkg.name}
              </h3>
              <p className="text-sm text-muted leading-relaxed mb-6">
                {pkg.description}
              </p>

              <div className="mb-6">
                <div className="text-sm text-muted font-medium mb-1">From</div>
                <span
                  className="text-ink tracking-tight"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "clamp(36px,3vw,48px)",
                  }}
                >
                  {pkg.price}
                </span>
                <span className="text-muted text-sm font-medium">/month</span>
              </div>

              <ul className="flex flex-col gap-3.5 mb-8 flex-1">
                {pkg.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-ink">
                    <Check className="w-4 h-4 text-accent-dark shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href="#contact"
                className={`inline-flex items-center justify-center gap-2 px-6 py-3.5 font-semibold text-[15px] rounded-full no-underline transition-all active:scale-[0.97] ${
                  pkg.highlighted
                    ? "bg-accent-dark text-white hover:opacity-90"
                    : "bg-ink/[0.06] text-ink hover:bg-ink/[0.1]"
                }`}
              >
                Get Started <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
