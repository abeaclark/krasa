import { useState } from "react";
import { Menu, X } from "lucide-react";

const navItems = [
  { label: "Packages", href: "#packages" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
];

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-accent">
      <nav className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
        <a
          href="#"
          className="text-xl font-bold tracking-tight text-accent-dark no-underline"
          style={{ fontFamily: "var(--font-logo)" }}
        >
          KRASA
        </a>

        <div className="hidden md:flex items-center gap-9">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-accent-dark/70 hover:text-accent-dark transition-colors no-underline tracking-tight"
            >
              {item.label}
            </a>
          ))}
        </div>

        <a
          href="#contact"
          className="hidden md:inline-flex items-center px-5 py-2.5 bg-accent-dark text-white text-[13px] font-semibold rounded-full no-underline hover:opacity-90 transition-opacity"
        >
          Get in Touch
        </a>

        <button
          className="md:hidden p-2 text-accent-dark bg-transparent border-none cursor-pointer"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {open && (
        <div className="md:hidden bg-accent border-b border-accent-dark/[0.12] px-6 pt-2 pb-5">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block py-3.5 font-medium text-[15px] text-accent-dark no-underline border-b border-accent-dark/[0.08]"
            >
              {item.label}
            </a>
          ))}
          <a
            href="#contact"
            onClick={() => setOpen(false)}
            className="block mt-4 text-center px-5 py-3 bg-accent-dark text-white text-sm font-semibold rounded-full no-underline"
          >
            Get in Touch
          </a>
        </div>
      )}
    </header>
  );
}
