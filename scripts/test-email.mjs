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
ok("subject pluralises", m.subject === "Your cancellation kit is ready", m.subject);
ok("greets by name", m.html.includes("Hi Tyna,"));
ok("lists every recipient", letters.every((l) => m.html.includes(l.recipient)));
ok("CAN-SPAM postal address", m.html.includes("PO Box 186, Hanalei, HI 96714"));
ok("legal name", m.html.includes("Krasa Development, LLC"));
ok("no unsubscribe on transactional mail", !m.html.includes("Unsubscribe from these check-ins"));
ok("plain-text alternative carries the address", m.text.includes("PO Box 186"));
ok("singular subject", lettersEmail({ letters: [letters[0]], linkDays: 30 }).subject === "Your cancellation kit is ready");
ok("handles a missing name", lettersEmail({ firstName: null, letters, linkDays: 30 }).html.includes("Hi,"));
ok("escapes a hostile name",
  !lettersEmail({ firstName: '<img src=x onerror=alert(1)>', letters, linkDays: 30 }).html.includes("<img src=x"));

console.log("\n=== outcome email ===");
for (const step of [30, 60, 90]) {
  const o = outcomeEmail({ firstName: "Abe", step, answerUrl: "https://k/api/outcome/T", unsubscribeUrl: "https://k/api/unsubscribe/U" });
  ok(`step ${step}: all three answers`, ["received", "waiting", "denied"].every((a) => o.html.includes(`?a=${a}`)));
  ok(`step ${step}: unsubscribe present`, o.html.includes("https://k/api/unsubscribe/U"));
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

console.log("\n=== done-for-you → 'easier than you think' ===");
{
  const { dfyEmail } = await import(join(out, "templates.js"));
  const { dueDfyEmail, dueDripStep } = await import(join(out, "drip.js"));
  const base = { firstSteps: ["GAP coverage: form", "Extended warranty (VSC): call"], dfyPrice: "$499", kitUrl: "https://k/restore?t=T", unsubscribeUrl: "https://k/api/unsubscribe/U" };
  const paid = dfyEmail({ ...base, firstName: "Abe", estimate: "$3,100–$5,200", kitPrice: "$19" });
  ok("subject", paid.subject === "It may be easier than you think");
  ok("lists what each product takes", paid.html.includes("GAP coverage") && paid.html.includes("one phone call"));
  ok("price comparison", paid.html.includes("$19") && paid.html.includes("$499"));
  ok("CTA to the kit", paid.html.includes("Get my kit for $19") && paid.html.includes("https://k/restore?t=T"));
  ok("still offers a reply to get it done for them", paid.text.includes("Reply to this email"));
  ok("unsubscribe present", paid.html.includes("https://k/api/unsubscribe/U") && paid.text.includes("https://k/api/unsubscribe/U"));
  const free = dfyEmail({ ...base, firstSteps: [], kitPrice: null });
  ok("free kit says free", free.html.includes("Open my free kit") && !free.html.includes("$19"));
  ok("fallback copy with no steps", free.html.includes("one phone call or one form"));
  ok("escapes a hostile name", !dfyEmail({ ...base, firstName: "<img src=x>", kitPrice: "$19" }).html.includes("<img src=x"));

  const now = new Date("2026-10-20T19:00:00Z"); // 3pm New York
  const createdAt = new Date("2026-10-20T17:00:00Z");
  const clicked = { _stages: [{ stage: "done-for-you-clicked", at: "2026-10-20T18:00:00Z" }] };
  const due = (meta, extra = {}) => dueDfyEmail({ meta, createdAt, hasEmail: true, now, ...extra });
  ok("due after a click and a quiet period", "send" in due(clicked));
  ok("also for the old request stage", "send" in due({ _stages: [{ stage: "done-for-you-requested", at: "2026-10-20T18:00:00Z" }] }));
  ok("not without a click", "skip" in due({ _stages: [{ stage: "plan-viewed", at: "2026-10-20T18:00:00Z" }] }));
  ok("not while still on the page", "skip" in due({ _stages: [{ stage: "done-for-you-clicked", at: "2026-10-20T18:55:00Z" }] }));
  ok("not twice", "skip" in due({ ...clicked, emails: { dfy: { at: "2026-10-20T18:30:00Z" } } }));
  ok("not if paid", "skip" in due({ ...clicked, purchase: { at: "x" } }));
  ok("not if unsubscribed", "skip" in due({ ...clicked, emailUnsubscribedAt: "x" }));
  ok("not without an email", "skip" in due(clicked, { hasEmail: false }));
  ok("not at night", "skip" in due(clicked, { now: new Date("2026-10-21T05:00:00Z") }));
  ok("not for an old click", "skip" in due({ _stages: [{ stage: "done-for-you-clicked", at: "2026-10-01T18:00:00Z" }] }, { createdAt: new Date("2026-10-01T17:00:00Z") }));
  // After the DFY email (recorded as the drip's "ready"), the next drip email waits a full gap.
  const after = { ...clicked, plan: { complete: true, paywall: true }, emails: { dfy: { at: "2026-10-20T18:30:00Z" }, drip: { sent: [{ step: "ready", at: "2026-10-20T18:30:00Z" }] } } };
  ok("drip waits after the DFY email", "skip" in dueDripStep({ meta: after, createdAt, hasEmail: true, now: new Date("2026-10-21T14:00:00Z") }));
  ok("drip resumes a day later", "step" in dueDripStep({ meta: after, createdAt, hasEmail: true, now: new Date("2026-10-21T18:00:00Z") }));
}

console.log("\n=== 20% early / 50% final drip ===");
{
  const { dripEmail } = await import(join(out, "templates.js"));
  const { dueDripStep, dripPercentOff, reusableDripOffer } = await import(join(out, "drip.js"));
  const now = new Date("2026-10-29T18:00:00Z");
  const createdAt = new Date("2026-10-28T17:00:00Z");
  const base = { products: ["GAP coverage"], firstSteps: ["GAP: form"], kitUrl: "https://k/restore?t=T", unsubscribeUrl: "https://k/unsubscribe/U", hasPlan: true };
  for (const step of ["ready", "shrinks", "how", "tip", "offer"]) {
    const pct = step === "offer" ? 50 : 20;
    const code = `KIT${pct}-TEST`;
    const offer = { code, percentOff: pct, expires: "Nov 1", url: `${base.kitUrl}&offer=${code}`, price: pct === 20 ? "$15.20" : "$9.50", fullPrice: "$19" };
    const m = dripEmail(step, { ...base, offer });
    ok(`${step}: correct discount in HTML and text`, m.html.includes(`${pct}% off`) && m.text.includes(`${pct}% off`));
    ok(`${step}: correct price`, m.html.includes(offer.price) && m.text.includes(offer.price));
    ok(`${step}: every kit link auto-applies code`, !m.html.includes('href="https://k/restore?t=T"') && m.text.includes(offer.url));
    ok(`${step}: unsubscribe retained`, m.html.includes(base.unsubscribeUrl));
    const sent = ["ready", "shrinks", "how", "tip", "offer"].slice(0, ["ready", "shrinks", "how", "tip", "offer"].indexOf(step)).map(step => ({ step, at: "2026-10-28T17:00:00Z" }));
    ok(`${step}: purchase stops sequence`, dueDripStep({ meta: { plan: { complete: true, paywall: true }, purchase: { sessionId: "paid" }, emails: { drip: { sent } } }, createdAt, hasEmail: true, now }).skip === "paid");
    ok(`${step}: expected policy`, dripPercentOff(step) === pct);
  }
  const early = { code: "KIT20-TEST", percentOff: 20, expiresAt: "2026-11-01T18:00:00Z" };
  ok("reuse early code across reminders", reusableDripOffer(early, "tip", now));
  ok("upgrade early code on final email", !reusableDripOffer(early, "offer", now));
  ok("refresh expired offers", !reusableDripOffer({ ...early, expiresAt: "2026-10-28T18:00:00Z" }, "ready", now));
  ok("replace legacy 30% on next scheduled send", !reusableDripOffer({ ...early, percentOff: 30 }, "shrinks", now));
}

console.log("\n=== 3-email drip, subject variants ===");
{
  const { dripEmail } = await import(join(out, "templates.js"));
  const { dueDripStep, DRIP_STEPS, subjectVariant } = await import(join(out, "drip.js"));
  ok("sequence is ready → shrinks → offer", DRIP_STEPS.join() === "ready,shrinks,offer");
  const createdAt = new Date("2026-10-28T17:00:00Z");
  const plan = { complete: true, paywall: true };
  const at = (h) => new Date(Date.parse("2026-10-28T17:00:00Z") + h * 3600_000);
  const meta = (steps) => ({ plan, state: "Texas", emails: { drip: { sent: steps.map((step) => ({ step, at: "2026-10-28T17:00:00Z" })) } } });
  ok("shrinks after ready", dueDripStep({ meta: meta(["ready"]), createdAt, hasEmail: true, now: at(21) }).step === "shrinks");
  ok("offer waits 44h after shrinks", "skip" in dueDripStep({ meta: meta(["ready", "shrinks"]), createdAt, hasEmail: true, now: at(30) }));
  ok("offer after 44h", dueDripStep({ meta: meta(["ready", "shrinks"]), createdAt, hasEmail: true, now: at(45) }).step === "offer");
  ok("mid-sequence (got how) skips to offer", dueDripStep({ meta: meta(["ready", "shrinks", "how"]), createdAt, hasEmail: true, now: at(45) }).step === "offer");
  ok("done after offer", dueDripStep({ meta: meta(["ready", "shrinks", "how", "tip", "offer"]), createdAt, hasEmail: true, now: at(100) }).skip === "done");

  const ids = ["9a1690f7-0000-4000-8000-000000000001", "aa3a1209-0000-4000-8000-000000000002", "257a9088-0000-4000-8000-000000000003", "07a074d7-0000-4000-8000-000000000004", "90c80405-0000-4000-8000-000000000005", "58236a15-0000-4000-8000-000000000006"];
  const arms = ids.map(subjectVariant);
  ok("variant is stable", ids.every((id) => subjectVariant(id) === subjectVariant(id)));
  ok("both arms used", arms.includes("a") && arms.includes("b"));

  const base = { firstName: "Abe", estimate: "up to $3,900", products: ["GAP coverage"], firstSteps: [], kitUrl: "https://k/r", unsubscribeUrl: "https://k/u", hasPlan: true };
  const offer = (pct) => ({ code: "C", percentOff: pct, expires: "Mon, Nov 2", url: "https://k/r&offer=C", price: pct === 50 ? "$9.50" : "$15.20", fullPrice: "$19" });
  ok("A ready: original", dripEmail("ready", { ...base, variant: "a", offer: offer(20) }).subject === "20% off your cancellation kit");
  ok("B ready: refund-led", dripEmail("ready", { ...base, variant: "b", offer: offer(20) }).subject === "Up to $3,900 back — your cancellation kit is ready");
  ok("B ready, no estimate: falls back", dripEmail("ready", { ...base, estimate: null, variant: "b", offer: offer(20) }).subject === "20% off your cancellation kit");
  ok("B ready, no plan", dripEmail("ready", { ...base, hasPlan: false, variant: "b", offer: offer(20) }).subject === "Abe, you're a minute from your refund kit");
  ok("A shrinks: original", dripEmail("shrinks", { ...base, variant: "a", offer: offer(20) }).subject === "Your refund gets smaller every month");
  ok("B shrinks", dripEmail("shrinks", { ...base, variant: "b", offer: offer(20) }).subject === "Abe, your refund is smaller next month");
  ok("B shrinks, full-refund window", dripEmail("shrinks", { ...base, fullRefundUntil: "Fri, Nov 20", variant: "b", offer: offer(20) }).subject === "Full-refund deadline: about Fri, Nov 20");
  ok("shrinks carries the money-back promise", dripEmail("shrinks", { ...base, offer: offer(20) }).text.includes("120 days"));
  ok("A offer: original", dripEmail("offer", { ...base, variant: "a", offer: offer(50) }).subject === "50% off your cancellation kit — until Mon, Nov 2");
  ok("B offer", dripEmail("offer", { ...base, variant: "b", offer: offer(50) }).subject === "Last chance: your kit for $9.50 (up to $3,900 back)");
}

console.log("\n=== abandoned checkout ===");
{
  const { checkoutEmail } = await import(join(out, "templates.js"));
  const { dueCheckoutEmail, dueDripStep } = await import(join(out, "drip.js"));
  const m = checkoutEmail({ firstName: "Abe", estimate: "$1,200–$3,900", products: ["GAP coverage → Ally"], price: "$19", kitUrl: "https://k/restore?t=T&utm_campaign=checkout-abandon", unsubscribeUrl: "https://k/u" });
  ok("subject", m.subject === "Did something go wrong at checkout?");
  ok("no discount", !/% off/.test(m.html) && m.html.includes("$19"));
  ok("CTA to kit", m.html.includes("https://k/restore?t=T&amp;utm_campaign=checkout-abandon") || m.html.includes("https://k/restore?t=T&utm_campaign=checkout-abandon"));
  ok("invites a reply", m.text.includes("reply"));
  ok("unsubscribe", m.html.includes("https://k/u") && m.text.includes("https://k/u"));
  ok("escapes name", !checkoutEmail({ firstName: "<b>x", products: [], price: "$19", kitUrl: "k", unsubscribeUrl: "u" }).html.includes("<b>x"));

  const createdAt = new Date("2026-10-30T17:00:00Z");
  const now = new Date("2026-10-30T19:00:00Z"); // 2pm Chicago
  const plan = { complete: true, paywall: true };
  const abandoned = { plan, state: "Texas", _stages: [{ stage: "plan-viewed", at: "2026-10-30T18:00:00Z" }, { stage: "checkout-started", at: "2026-10-30T18:05:00Z" }] };
  const due = (meta, extra = {}) => dueCheckoutEmail({ meta, createdAt, hasEmail: true, now, ...extra });
  ok("due 45+ min after abandoning", "send" in due(abandoned));
  ok("buy-click alone counts", "send" in due({ ...abandoned, _stages: [{ stage: "buy-clicked", at: "2026-10-30T18:05:00Z" }] }));
  ok("not while still active", "skip" in due(abandoned, { now: new Date("2026-10-30T18:40:00Z") }));
  ok("not if paid", due({ ...abandoned, purchase: { at: "x" } }).skip === "paid");
  ok("not if unsubscribed", "skip" in due({ ...abandoned, emailUnsubscribedAt: "x" }));
  ok("only once", "skip" in due({ ...abandoned, emails: { checkout: { at: "2026-10-30T18:55:00Z" } } }));
  ok("not at night", "skip" in due(abandoned, { now: new Date("2026-10-31T06:00:00Z") }));
  ok("not after 48h", "skip" in due(abandoned, { now: new Date("2026-11-01T20:00:00Z") }));
  ok("not right after another email", due({ ...abandoned, emails: { drip: { sent: [{ step: "ready", at: "2026-10-30T17:30:00Z" }] } } }).skip === "recent email");
  ok("drip 'ready' holds while checkout email is pending", dueDripStep({ meta: abandoned, createdAt, hasEmail: true, now }).skip === "checkout email pending");
  const after = { ...abandoned, emails: { checkout: { at: "2026-10-30T19:00:00Z" }, drip: { sent: [{ step: "ready", at: "2026-10-30T19:00:00Z" }] } } };
  ok("drip waits a full gap after it", "skip" in dueDripStep({ meta: after, createdAt, hasEmail: true, now: new Date("2026-10-31T14:00:00Z") }));
  ok("then continues with shrinks", dueDripStep({ meta: after, createdAt, hasEmail: true, now: new Date("2026-10-31T16:00:00Z") }).step === "shrinks");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
