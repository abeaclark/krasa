"use client";

import { useState } from "react";
import { ArrowRight, Send } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { submitLead } from "@/lib/leads";

export function Contact() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [company, setCompany] = useState(""); // honeypot — hidden from users
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!/(.+)@(.+){2,}\.(.+){2,}/.test(email)) {
      setError("Please enter a valid email");
      trackEvent("form_error", {
        form_location: "contact_section",
        error_field: "email",
        error_reason: "invalid_email",
      });
      return;
    }

    if (message.length < 25) {
      setError("Please tell us a bit more — at least 25 characters");
      trackEvent("form_error", {
        form_location: "contact_section",
        error_field: "message",
        error_reason: "too_short",
        message_length: message.length,
      });
      return;
    }

    setSubmitting(true);
    const result = await submitLead({
      source: "contact",
      email,
      message,
      hp: company,
      meta: { form_location: "contact_section" },
    });
    setSubmitting(false);

    if (!result.ok) {
      setError("Something went wrong — please try again or email us directly.");
      trackEvent("form_error", {
        form_location: "contact_section",
        error_field: "submit",
        error_reason: "request_failed",
      });
      return;
    }

    // GA4 recommended event for lead capture.
    trackEvent("generate_lead", {
      form_location: "contact_section",
      message_length: message.length,
    });

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
          Get in touch
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
            {/* Honeypot: visually hidden, off-screen, not tab-reachable. */}
            <input
              type="text"
              name="company"
              tabIndex={-1}
              autoComplete="off"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              aria-hidden="true"
              style={{
                position: "absolute",
                left: "-9999px",
                width: 1,
                height: 1,
                opacity: 0,
              }}
            />
            <button
              type="submit"
              disabled={submitting}
              className="w-full px-7 py-3.5 bg-accent text-accent-dark text-[15px] font-semibold rounded-full border-none cursor-pointer whitespace-nowrap inline-flex items-center justify-center gap-2 hover:brightness-95 transition-all active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" /> {submitting ? "Sending…" : "Send"}
            </button>
          </form>
        )}

        {error && <p className="text-sm text-red-400 mt-3">{error}</p>}

        <div className="flex justify-center gap-5 mt-12">
          <a
            href="https://x.com/abe_clark"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              trackEvent("outbound_click", {
                link_domain: "x.com",
                link_url: "https://x.com/abe_clark",
                link_label: "X",
                link_location: "contact_section",
              })
            }
            className="text-[13px] font-semibold text-white/35 no-underline hover:text-white transition-colors"
          >
            X
          </a>
          <a
            href="https://www.linkedin.com/in/abrahamclark/"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              trackEvent("outbound_click", {
                link_domain: "linkedin.com",
                link_url: "https://www.linkedin.com/in/abrahamclark/",
                link_label: "LinkedIn",
                link_location: "contact_section",
              })
            }
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/35 no-underline hover:text-white transition-colors"
          >
            LinkedIn <ArrowRight className="w-3 h-3" />
          </a>
        </div>
      </div>
    </section>
  );
}
