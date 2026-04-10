const acquisitions = [
  {
    left: { name: "Influenceli", src: "/influenceli.jpeg", alt: "Influenceli logo" },
    right: { name: "Fermat", src: "/fermat.jpeg", alt: "Fermat logo" },
  },
  {
    left: { name: "nucreator", src: "/nucreator.jpeg", alt: "nucreator logo" },
    right: { name: "Manifest", src: "/manifest.jpeg", alt: "Manifest logo" },
  },
  {
    left: { name: "Homebuyer.com", src: "/homebuyer.jpeg", alt: "Homebuyer.com logo" },
    right: { name: "OpenDoor", src: "/opendoor.jpeg", alt: "OpenDoor logo" },
  },
] as const;

const cardClass =
  "bg-surface rounded-2xl border border-ink/[0.07] p-5 sm:p-7 text-center shadow-[0_1px_3px_rgba(14,15,12,0.04),0_4px_12px_rgba(14,15,12,0.02)]";

export function PastSuccesses() {
  return (
    <div className="mt-12 mx-auto w-full max-w-[450px]">
      <div className="text-center mb-10">
        <div className="flex items-center justify-center gap-2 text-xs font-bold tracking-[0.06em] uppercase text-accent-dark/50 mb-3">
          Past Successes
        </div>
        <h3
          className="uppercase tracking-[0.03em] leading-[1.0] text-ink"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(26px,3vw,36px)",
          }}
        >
          Acquisitions
        </h3>
      </div>

      <div className="flex flex-col gap-5">
        {acquisitions.map((row) => (
          <div key={row.left.name} className={cardClass}>
            <div className="flex flex-row flex-nowrap items-center justify-center gap-2 sm:gap-3 min-w-0">
              <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <div className="flex h-12 w-full max-w-[min(100%,9rem)] items-center justify-center sm:h-14 md:h-16">
                  <img
                    src={row.left.src}
                    alt={row.left.alt}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <span className="text-[12px] font-medium leading-tight text-muted sm:text-[13px]">
                  {row.left.name}
                </span>
              </div>

              <span className="shrink-0 px-0.5 text-[11px] font-semibold leading-none tracking-tight text-muted/80 sm:text-xs">
                acquired by
              </span>

              <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <div className="flex h-12 w-full max-w-[min(100%,9rem)] items-center justify-center sm:h-14 md:h-16">
                  <img
                    src={row.right.src}
                    alt={row.right.alt}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <span className="text-[12px] font-medium leading-tight text-muted sm:text-[13px]">
                  {row.right.name}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
