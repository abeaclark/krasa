#!/usr/bin/env node
/**
 * Tests for the email layer — tokens, templates and the follow-up schedule.
 *
 *   node scripts/test-email.mjs
 *
 * No database and no network: everything here is pure. It compiles
 * src/lib/email/*.ts to a temp dir with tsc and exercises it, which is enough
 * to cover the parts that would otherwise only be discovered by a customer
 * receiving a broken email.
 */
import { execSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "email-test-"));
execSync(
  `npx tsc src/lib/email/*.ts --outDir ${out} --module commonjs --target es2022 ` +
    `--skipLibCheck --moduleResolution node --esModuleInterop`,
  { stdio: "inherit" },
);

process.env.EMAIL_TOKEN_SECRET = "test-secret-at-least-16-chars-long";
process.env.EMAIL_LINK_ORIGIN = "https://www.krasadev.com";

const { createToken, verifyToken, tokensConfigured } = await import(join(out, "tokens.js"));
const { lettersEmail, outcomeEmail, outcomeLandingPage } = await import(join(out, "templates.js"));
const { dueOutcomeStep } = await import(join(out, "schedule.js"));

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") =>
  cond ? (pass++, console.log("  ok   " + name)) : (fail++, console.log("  FAIL " + name + " " + extra));

console.log("=== tokens ===");
const LEAD = "a5778b18-fc5f-450f-94d7-62e4f5ffab5c";
ok("configured", tokensConfigured());
const t = createToken(LEAD, "outcome");
ok("round-trips", verifyToken(t, "outcome").leadId === LEAD);
ok("rejects wrong purpose", !verifyToken(t, "unsubscribe").ok);
ok("rejects tampered payload", !verifyToken("x" + t, "outcome").ok);
ok("rejects garbage", !verifyToken("nonsense", "outcome").ok);
ok("rejects expired", verifyToken(createToken(LEAD, "outcome", -1), "outcome").reason === "expired");
ok("is lead-specific",
  verifyToken(createToken("00000000-0000-4000-8000-000000000000", "outcome"), "outcome").leadId !== LEAD);

console.log("\n=== follow-up schedule ===");
ok("nothing due before day 30", dueOutcomeStep(12, []) === null);
ok("day 30 due at 30", dueOutcomeStep(30, []) === 30);
ok("day 30 not resent", dueOutcomeStep(45, [30]) === null);
ok("day 60 due after 30 sent", dueOutcomeStep(61, [30]) === 60);
ok("day 90 due after both", dueOutcomeStep(95, [30, 60]) === 90);
ok("no fourth ask", dueOutcomeStep(400, [30, 60, 90]) === null);
// The catch-up case: a lead that predates the feature must not get three
// emails in one morning.
ok("backlog sends only the latest", dueOutcomeStep(365, []) === 90);

console.log("\n=== letters email ===");
const letters = [
  { title: "Extended warranty (VSC) — cancellation letter", recipient: "Universal Underwriters Service Corporation", url: "https://example.test/a.pdf" },
  { title: "GAP coverage — cancellation letter", recipient: "GS Administrators, Inc.", url: "https://example.test/b.pdf" },
];
const m = lettersEmail({ firstName: "Tyna", letters, linkDays: 30 });
ok("subject pluralises", m.subject === "Your 2 cancellation letters are ready", m.subject);
ok("greets by name", m.html.includes("Hi Tyna,"));
ok("lists every recipient", letters.every((l) => m.html.includes(l.recipient)));
ok("CAN-SPAM postal address", m.html.includes("PO Box 186, Hanalei, HI 96714"));
ok("legal name", m.html.includes("Krasa Development, LLC"));
ok("no unsubscribe on transactional mail", !m.html.includes("Unsubscribe from these check-ins"));
ok("plain-text alternative carries the address", m.text.includes("PO Box 186"));
ok("singular subject", lettersEmail({ letters: [letters[0]], linkDays: 30 }).subject === "Your cancellation letter is ready");
ok("handles a missing name", lettersEmail({ firstName: null, letters, linkDays: 30 }).html.includes("Hi,"));
ok("escapes a hostile name",
  !lettersEmail({ firstName: '<img src=x onerror=alert(1)>', letters, linkDays: 30 }).html.includes("<img src=x"));

console.log("\n=== outcome email ===");
for (const step of [30, 60, 90]) {
  const o = outcomeEmail({ firstName: "Abe", step, answerUrl: "https://k/api/outcome/T", unsubscribeUrl: "https://k/api/unsubscribe/U" });
  ok(`step ${step}: all three answers`, ["received", "waiting", "denied"].every((a) => o.html.includes(`?a=${a}`)));
  ok(`step ${step}: unsubscribe present`, o.html.includes("Unsubscribe from these check-ins"));
  ok(`step ${step}: text version has links`, o.text.includes("?a=received"));
}
ok("subject changes by step",
  outcomeEmail({ step: 30, answerUrl: "u", unsubscribeUrl: "x" }).subject !==
  outcomeEmail({ step: 90, answerUrl: "u", unsubscribeUrl: "x" }).subject);

console.log("\n=== landing page ===");
for (const a of ["received", "waiting", "denied"]) {
  const pg = outcomeLandingPage({ answer: a, answerUrl: "https://k/api/outcome/T" });
  ok(`${a}: renders`, pg.includes("<h1"));
  ok(`${a}: offers the other two as corrections`,
    ["received", "waiting", "denied"].filter((x) => x !== a).every((x) => pg.includes(`?a=${x}`)));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
