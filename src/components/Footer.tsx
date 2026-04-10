export function Footer() {
  return (
    <footer className="bg-ink">
      <div className="max-w-[1200px] mx-auto px-6 py-10 flex justify-between items-center flex-wrap gap-4">
        <p className="text-xs text-white/25">
          &copy; {new Date().getFullYear()} Krasa. All rights reserved.
        </p>
        <div className="flex gap-5">
          <a
            href="https://x.com/abe_clark"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] font-semibold text-white/35 no-underline hover:text-white transition-colors"
          >
            X
          </a>
          <a
            href="https://www.linkedin.com/in/abrahamclark/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] font-semibold text-white/35 no-underline hover:text-white transition-colors"
          >
            LinkedIn
          </a>
        </div>
      </div>
    </footer>
  );
}
