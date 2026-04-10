import { useState } from "react";
import { ArrowRight, Send } from "lucide-react";

/** From Google Form `data-params`: Message field → `[[286011078,...` → `entry.286011078` */
const MESSAGE_ENTRY_ID = "entry.286011078";

export function Contact() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!/(.+)@(.+){2,}\.(.+){2,}/.test(email)) {
      setError("Please enter a valid email");
      return;
    }

    if (message.length < 25) {
      setError("Please tell us a bit more — at least 25 characters");
      return;
    }

    const body = new URLSearchParams();
    body.set("entry.1565278741", email);
    body.set(MESSAGE_ENTRY_ID, message);

    fetch(
      "https://docs.google.com/forms/d/e/1FAIpQLSeWe-ldEj7_t1tPJl2BRw9Hd4qW55LZwbNUPlo5uUXEU2XxAw/formResponse?origin=*",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        mode: "no-cors",
      },
    );

    setSubmitted(true);
  }

  return (
    <section id="contact" className="px-6 pb-24">
      <div className="max-w-[1000px] mx-auto bg-ink rounded-3xl py-20 px-10 text-center">
        <h2
          className="uppercase tracking-[0.02em] leading-[0.95] text-white mb-4"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(36px,4vw,56px)",
          }}
        >
          Let's get in touch
        </h2>
        <p className="text-lg text-white/50 max-w-[460px] mx-auto mb-10">
          Drop your email and we'll reach out to discuss how Krasa can help your
          brand.
        </p>

        {submitted ? (
          <div className="text-xl font-semibold text-accent">
            Got it, we'll be in touch.
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-3 max-w-[440px] mx-auto"
          >
            <input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              className="w-full px-5 py-3.5 bg-white/[0.06] border border-white/10 rounded-full text-[15px] text-white placeholder:text-white/30 outline-none focus:border-accent/50 transition-colors"
            />
            <textarea
              placeholder="Tell us about your brand"
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setError("");
              }}
              rows={3}
              className="w-full px-5 py-3.5 bg-white/[0.06] border border-white/10 rounded-2xl text-[15px] text-white placeholder:text-white/30 outline-none focus:border-accent/50 transition-colors resize-none"
            />
            <button
              type="submit"
              className="w-full px-7 py-3.5 bg-accent text-accent-dark text-[15px] font-semibold rounded-full border-none cursor-pointer whitespace-nowrap inline-flex items-center justify-center gap-2 hover:brightness-95 transition-all active:scale-[0.97]"
            >
              <Send className="w-4 h-4" /> Send
            </button>
          </form>
        )}

        {error && (
          <p className="text-sm text-red-400 mt-3">{error}</p>
        )}

        <div className="flex justify-center gap-5 mt-12">
          <a
            href="https://twitter.com/kaboracle"
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
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/35 no-underline hover:text-white transition-colors"
          >
            LinkedIn <ArrowRight className="w-3 h-3" />
          </a>
        </div>
      </div>
    </section>
  );
}
