import { EMAIL } from "./config";
import { button, paragraph, textFooter, wrap, type Button } from "./layout";

/**
 * The two messages we send, and the copy that makes them worth receiving.
 *
 * House style: say the useful thing first, keep the caveats honest but short,
 * and never imply a refund is owed or guaranteed. Every claim here has to
 * survive being read back by someone who did not get a refund.
 */

export interface LetterSummary {
  title: string;
  /** Who it goes to, e.g. "GS Administrators, Inc." */
  recipient: string;
  /** Signed, expiring download link. */
  url: string;
  /** What to do first for this product, e.g. "Call Luther Kia's finance office at (952) 258-8400". */
  firstStep?: string | null;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ---------------------------------------------------------------------------
// 1. Letters delivered — transactional, sent immediately
// ---------------------------------------------------------------------------

export function lettersEmail(opts: {
  firstName?: string | null;
  letters: LetterSummary[];
  /** How long the download links last, in days. */
  linkDays: number;
  /** One-click link that reopens their whole kit on any device. */
  kitUrl?: string | null;
  /** Mention the later "did it arrive?" check-in (not for paying customers). */
  checkIn?: boolean;
}) {
  const hi = opts.firstName ? `Hi ${esc(opts.firstName)},` : "Hi,";
  const n = opts.letters.length;
  const subject = "Your cancellation kit is ready";

  const list = opts.letters
    .map(
      (l) => `<tr><td style="padding:0 0 14px;">
        <p style="margin:0 0 3px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#131c18;">${esc(l.title)}</p>
        ${l.firstStep ? `<p style="margin:0 0 3px;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#131c18;">First: ${esc(l.firstStep)}</p>` : ""}
        <p style="margin:0 0 6px;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#6b7a73;">Letter goes to ${esc(l.recipient)}</p>
        <a href="${l.url}" style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#15624a;">Download PDF</a>
      </td></tr>`,
    )
    .join("");

  const bodyHtml = [
    paragraph(hi),
    paragraph(
      "Here is your cancellation kit. For each product, do the first step below — often a quick call or the company's own form. Sign the letter and keep it: it's your dated, written request.",
    ),
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;">${list}</table>`,
    paragraph(
      `These links work for ${opts.linkDays} days. Save the PDFs somewhere safe — that way you still have them if you need to send a second copy.`,
    ),
    ...(opts.kitUrl
      ? [`<div style="margin:0 0 8px;">${button({ label: "Open your kit on any device", href: opts.kitUrl })}</div>`]
      : []),
    `<p style="margin:24px 0 10px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#131c18;">Three things that make this work</p>`,
    `<ol style="margin:0 0 18px;padding-left:20px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#3d4a44;">
      <li style="margin-bottom:6px;">Do the first step for each product, and note the date and who you spoke to.</li>
      <li style="margin-bottom:6px;">Anything you mail, send with tracking. Certified mail with return receipt costs about $9 and proves the date they received it — the date your refund is measured from.</li>
      <li>Keep a copy of everything you send or sign, plus your payoff letter or bill of sale if the car is gone.</li>
    </ol>`,
    paragraph(
      "Most refunds take four to eight weeks. If you have not heard anything after two weeks, call the number on the letter and ask them to confirm they received it.",
    ),
    ...(opts.checkIn === false
      ? []
      : [
          paragraph(
            `<span style="color:#6b7a73;font-size:14px;">We will check in once your letters have had time to land, to ask whether the money actually arrived. One click, and it helps us know whether any of this works.</span>`,
          ),
        ]),
  ].join("");

  const text = [
    hi,
    "",
    "Here is your cancellation kit. For each product, do the first step below — often a quick call or the company's own form. Sign the letter and keep it: it's your dated, written request.",
    "",
    ...opts.letters.map((l) => `${l.title}${l.firstStep ? `\n  First: ${l.firstStep}` : ""}\n  Letter goes to ${l.recipient}\n  ${l.url}`),
    "",
    `These links work for ${opts.linkDays} days. Save the PDFs somewhere safe.`,
    ...(opts.kitUrl ? ["", `Open your kit on any device: ${opts.kitUrl}`] : []),
    "",
    "Three things that make this work:",
    "1. Do the first step for each product, and note the date and who you spoke to.",
    "2. Anything you mail, send with tracking — certified mail proves the date they received it.",
    "3. Keep a copy of everything you send or sign.",
    "",
    "Most refunds take four to eight weeks. If you have not heard anything after two weeks, call the number on the letter and confirm they received it.",
    textFooter(),
  ].join("\n");

  return {
    subject,
    html: wrap({
      preheader:
        "What to do first for each product, and your letters.",
      bodyHtml,
    }),
    text,
  };
}

// ---------------------------------------------------------------------------
// 2. Outcome check-in — the follow-up sequence
// ---------------------------------------------------------------------------

export type { OutcomeStep } from "./schedule";
import type { OutcomeStep } from "./schedule";

const STEP_COPY: Record<OutcomeStep, { subject: string; opener: string }> = {
  30: {
    subject: "Did your refund come through?",
    opener:
      "It has been about a month since your letters were ready. Did anything land?",
  },
  60: {
    subject: "Any word on your refund?",
    opener:
      "It has been about two months now. Refunds at this stage are often just slow rather than refused — but it is worth knowing which.",
  },
  90: {
    subject: "Last check — did you get your refund?",
    opener:
      "This is the last time we will ask. Three months is past the point where most administrators have paid, so if nothing has arrived it is worth chasing.",
  },
};

export function outcomeEmail(opts: {
  firstName?: string | null;
  step: OutcomeStep;
  /** Base one-click URL; the answer is appended as ?a=... */
  answerUrl: string;
  unsubscribeUrl: string;
}) {
  const copy = STEP_COPY[opts.step];
  const hi = opts.firstName ? `Hi ${esc(opts.firstName)},` : "Hi,";

  const buttons: Button[] = [
    { label: "Yes, I got paid", href: `${opts.answerUrl}?a=received`, primary: true },
    { label: "Not yet", href: `${opts.answerUrl}?a=waiting` },
    { label: "I was turned down", href: `${opts.answerUrl}?a=denied` },
  ];

  const bodyHtml = [
    paragraph(hi),
    paragraph(copy.opener),
    paragraph("<strong>One click is the whole answer.</strong> Nothing to fill in."),
    `<div style="margin:0 0 6px;">${buttons.map(button).join("")}</div>`,
    paragraph(
      `<span style="color:#6b7a73;font-size:14px;">We ask because nobody publishes whether these refunds actually get paid. Your answer tells the next person what to expect — and if you were turned down, tell us why and we will look at whether it was correct.</span>`,
    ),
  ].join("");

  const text = [
    hi,
    "",
    copy.opener,
    "",
    "One click is the whole answer:",
    `  Yes, I got paid:     ${opts.answerUrl}?a=received`,
    `  Not yet:             ${opts.answerUrl}?a=waiting`,
    `  I was turned down:   ${opts.answerUrl}?a=denied`,
    "",
    "We ask because nobody publishes whether these refunds actually get paid. Your answer tells the next person what to expect.",
    textFooter(opts.unsubscribeUrl),
  ].join("\n");

  return {
    subject: copy.subject,
    html: wrap({
      preheader: "One click — yes, not yet, or turned down.",
      bodyHtml,
      unsubscribeUrl: opts.unsubscribeUrl,
    }),
    text,
  };
}

/** Landing page shown after a one-click answer. */
export function outcomeLandingPage(opts: {
  answer: "received" | "waiting" | "denied";
  answerUrl: string;
}): string {
  const HEAD: Record<string, { title: string; body: string }> = {
    received: {
      title: "That is genuinely good to hear.",
      body: "Thank you — recorded. If you feel like telling us how much came back, it helps us make the next person's estimate more honest. Reply to the email with a number and that is plenty.",
    },
    waiting: {
      title: "Noted — still waiting.",
      body: "That is common at this stage. If it has been more than two weeks since they received your letter, call the number on it and ask them to confirm receipt and give you a decision date. Written follow-up beats waiting.",
    },
    denied: {
      title: "Sorry — that is frustrating.",
      body: "Recorded. Turn-downs are sometimes wrong: a paid claim, an expired term or a missing contract number can all produce a refusal that should not stand. Reply to the email and tell us what they said, and we will tell you honestly whether it is worth pushing.",
    },
  };
  const h = HEAD[opts.answer];
  const other = (a: string, label: string) =>
    a === opts.answer
      ? ""
      : `<a href="${opts.answerUrl}?a=${a}" style="color:#6b7a73;font-size:14px;margin-right:14px;">${label}</a>`;

  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Thanks</title></head>
<body style="margin:0;background:#f6f7f4;font-family:Helvetica,Arial,sans-serif;">
<div style="max-width:520px;margin:0 auto;padding:64px 20px;">
  <p style="font-size:15px;font-weight:700;color:#15624a;margin:0 0 28px;">${EMAIL.brand}</p>
  <h1 style="font-size:26px;line-height:1.25;color:#131c18;margin:0 0 14px;">${h.title}</h1>
  <p style="font-size:16px;line-height:1.6;color:#3d4a44;margin:0 0 28px;">${h.body}</p>
  <p style="font-size:14px;color:#6b7a73;margin:0 0 8px;">Clicked the wrong one?</p>
  <p style="margin:0 0 32px;">
    ${other("received", "I got paid")}${other("waiting", "Still waiting")}${other("denied", "I was turned down")}
  </p>
  <p style="margin:0;"><a href="${EMAIL.siteUrl}" style="color:#15624a;font-size:15px;">Back to ${EMAIL.brand}</a></p>
</div></body></html>`;
}

// ---------------------------------------------------------------------------
// 3. Get back to your kit — a sign-in link, no password
// ---------------------------------------------------------------------------

export function restoreEmail(opts: { firstName?: string | null; url: string; hours: number }) {
  const hi = opts.firstName ? `Hi ${esc(opts.firstName)},` : "Hi,";
  const bodyHtml = [
    paragraph(hi),
    paragraph("Here's the link to open your cancellation kit on this device — your answers, your plan, and anything you've paid for."),
    `<div style="margin:0 0 8px;">${button({ label: "Open my kit", href: opts.url, primary: true })}</div>`,
    paragraph(
      `<span style="color:#6b7a73;font-size:14px;">The link works for ${opts.hours} hours. If you didn't ask for it, you can ignore this email — nothing changes unless the link is opened.</span>`,
    ),
  ].join("");
  const text = [
    hi,
    "",
    "Here's the link to open your cancellation kit on this device — your answers, your plan, and anything you've paid for:",
    opts.url,
    "",
    `The link works for ${opts.hours} hours. If you didn't ask for it, you can ignore this email.`,
    textFooter(),
  ].join("\n");
  return { subject: "Your Refund Auto kit link", html: wrap({ preheader: "Open your cancellation kit on this device.", bodyHtml }), text };
}

// ---------------------------------------------------------------------------
// 4. "Didn't pay" drip (see lib/email/drip.ts for who gets what, when)
// ---------------------------------------------------------------------------

export interface DripData {
  firstName?: string | null;
  /** e.g. "$1,660–$3,960" */
  estimate?: string | null;
  /** e.g. ["GAP → GS Administrators", "Extended warranty → Dealers Alliance"] */
  products: string[];
  /** Plan's first steps, e.g. ["GAP coverage: form", "Extended warranty (VSC): call"] */
  firstSteps: string[];
  /** Latest date a full refund may still be possible, when the paperwork showed a purchase date. */
  fullRefundUntil?: string | null;
  kitUrl: string;
  unsubscribeUrl: string;
  offer?: { code: string; percentOff: number; expires: string; url: string; price: string; fullPrice: string } | null;
  /** False when they left before seeing their plan — the first email asks them to finish instead. */
  hasPlan?: boolean;
  /** Subject-line test arm (lib/email/drip.ts subjectVariant). "a" = the original subjects. */
  variant?: import("./drip").SubjectVariant;
}

/** "Up to $3,900 back" / "$1,200–$3,900 back", or null. */
function refundBack(estimate?: string | null): string | null {
  if (!estimate) return null;
  return `${estimate.charAt(0).toUpperCase()}${estimate.slice(1)} back`;
}

const METHOD_TIP: Record<string, string> = {
  form: "needs the company's own cancellation form — it's in your kit, already matched to your contract",
  call: "cancels fastest by phone — your kit has the number and exactly what to say",
  dealer: "goes through the dealership's finance office — your kit has their number and what to ask for",
  lender: "goes through your lender — your kit has who to call and what to say",
  notarized: "needs a notarized form — your kit tells you where to get it done free",
  mail: "cancels by mail — your letter is filled in and ready to sign",
  claim: "is a GAP claim, not a cancellation — your kit walks you through opening it",
};

export function dripEmail(step: import("./drip").DripStep, d: DripData) {
  const hi = d.firstName ? `Hi ${esc(d.firstName)},` : "Hi,";
  // Every action link carries the same automatically applied offer.
  const kitUrl = d.offer?.url ?? d.kitUrl;
  const list = d.products.length
    ? `<ul style="margin:0 0 16px;padding-left:20px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#3d4a44;">${d.products.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>`
    : "";
  const cta = (label: string, href: string) => `<div style="margin:0 0 16px;">${button({ label, href, primary: true })}</div>`;
  const est = d.estimate
    ? d.estimate.startsWith("up to")
      ? ` — <strong>${esc(d.estimate)}</strong>`
      : ` — an estimated <strong>${esc(d.estimate)}</strong>`
    : "";

  let subject = "";
  let preheader = "";
  let body: string[] = [];
  let text: string[] = [];

  const b = d.variant === "b";
  const back = refundBack(d.estimate);
  const name = d.firstName ? `${d.firstName}, ` : "";

  if (step === "ready" && d.hasPlan === false) {
    subject = b ? `${name}${name ? "you're" : "You're"} a minute from your refund kit` : "Finish your refund check";
    preheader = "You're a minute away from seeing who holds your refund.";
    body = [
      paragraph(hi),
      paragraph(`You're almost done checking your refund${est ? `${est} could be at stake` : ""}. Pick up where you left off — it takes about a minute.`),
      cta("Finish my refund check", kitUrl),
      paragraph(`<span style="color:#6b7a73;font-size:14px;">The link opens your answers on any device — no password.</span>`),
    ];
    text = [hi, "", "You're almost done checking your refund. Pick up where you left off:", kitUrl];
  } else if (step === "ready") {
    subject = "Your cancellation kit is ready";
    preheader = "Who to contact for each product, and your paperwork filled in.";
    body = [
      paragraph(hi),
      paragraph(`Your cancellation kit is ready${est} in refunds at stake. We've matched each product to the company that handles it:`),
      list,
      cta("Open my kit", kitUrl),
      paragraph(`<span style="color:#6b7a73;font-size:14px;">The link opens your kit on any device — no password.</span>`),
    ];
    text = [hi, "", `Your cancellation kit is ready${d.estimate ? ` — an estimated ${d.estimate} in refunds at stake` : ""}.`, ...d.products.map((p) => `- ${p}`), "", `Open my kit: ${kitUrl}`];
  } else if (step === "shrinks") {
    subject = d.fullRefundUntil
      ? b ? `Full-refund deadline: about ${d.fullRefundUntil}` : `You may still get a full refund — until about ${d.fullRefundUntil}`
      : b ? `${name}${name ? "your" : "Your"} refund is smaller next month` : "Your refund gets smaller every month";
    preheader = "Cancelling sooner means more money back.";
    const lead = d.fullRefundUntil
      ? `Your paperwork shows these were bought recently. Many contracts refund the <strong>whole price</strong> if you cancel within the first 30–60 days — for you that's until about <strong>${esc(d.fullRefundUntil)}</strong>.`
      : "Refunds on these products are worked out from the time left on the contract. Every month you wait, the unused part — and your refund — gets smaller.";
    const promise = "If no refund arrives within 120 days, email us and we'll give you your money back.";
    body = [paragraph(hi), paragraph(lead), paragraph("Your kit has everything ready to start today: who to contact for each product, what to say, and your paperwork filled in."), cta("Open my kit", kitUrl), paragraph(`<span style="color:#6b7a73;font-size:14px;">${promise}</span>`)];
    text = [hi, "", lead.replace(/<[^>]+>/g, ""), "", `Open my kit: ${kitUrl}`, "", promise];
  } else if (step === "how") {
    subject = "What happens after you get your kit";
    preheader = "The steps, and our money-back promise.";
    body = [
      paragraph(hi),
      paragraph("Here's how it works once you unlock your kit:"),
      `<ol style="margin:0 0 16px;padding-left:20px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#3d4a44;">
        <li style="margin-bottom:6px;">For each product, one first step — usually a quick call or the company's own form. We tell you exactly who and what to say.</li>
        <li style="margin-bottom:6px;">Sign the letter we filled in. It's your dated, written request.</li>
        <li>Most refunds arrive in 4–8 weeks.</li>
      </ol>`,
      paragraph("<strong>If no refund arrives within 120 days, email us and we'll give you your money back.</strong> And you can ask for a refund for any reason in the first 30 days."),
      cta("Open my kit", kitUrl),
    ];
    text = [hi, "", "How it works: one first step per product (a call or their form), sign the letter we filled in, most refunds arrive in 4-8 weeks.", "If no refund arrives within 120 days, email us and we'll give you your money back.", "", `Open my kit: ${kitUrl}`];
  } else if (step === "tip") {
    const tips = d.firstSteps
      .map((s) => {
        const [label, method] = s.split(/:\s*/);
        return METHOD_TIP[method] ? `<strong>${esc(label)}</strong> ${METHOD_TIP[method]}.` : null;
      })
      .filter(Boolean) as string[];
    subject = "The step most people miss";
    preheader = "Each product cancels a different way.";
    body = [
      paragraph(hi),
      paragraph("The most common reason these refunds stall: people send a letter to the wrong place, or skip the company's own form. Each of your products cancels a different way:"),
      tips.length
        ? `<ul style="margin:0 0 16px;padding-left:20px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#3d4a44;">${tips.map((t) => `<li style="margin-bottom:6px;">${t}</li>`).join("")}</ul>`
        : "",
      cta("Open my kit", kitUrl),
    ];
    text = [hi, "", "Each of your products cancels a different way:", ...tips.map((t) => `- ${t.replace(/<[^>]+>/g, "")}`), "", `Open my kit: ${kitUrl}`];
  } else if (step === "offer" && d.offer) {
    const o = d.offer;
    subject = b ? `Last chance: your kit for ${o.price}${back ? ` (${back.charAt(0).toLowerCase()}${back.slice(1)})` : ""}` : `${o.percentOff}% off your cancellation kit — until ${o.expires}`;
    preheader = `${o.price} instead of ${o.fullPrice}. Code ${o.code}.`;
    body = [
      paragraph(hi),
      paragraph(`Here's ${o.percentOff}% off your cancellation kit: <strong>${esc(o.price)}</strong> instead of ${esc(o.fullPrice)}${est ? `, with${est} at stake` : ""}.`),
      paragraph(`Your code <strong>${esc(o.code)}</strong> is applied automatically from the button below. It's just for you and works until <strong>${esc(o.expires)}</strong>.`),
      cta(`Get my kit for ${o.price}`, o.url),
      paragraph(`<span style="color:#6b7a73;font-size:14px;">Still covered by our promise: no refund within 120 days, your money back.</span>`),
    ];
    text = [hi, "", `${o.percentOff}% off your cancellation kit: ${o.price} instead of ${o.fullPrice}.`, `Code ${o.code} — works until ${o.expires}.`, "", `Get my kit: ${o.url}`];
  }

  if (d.offer && step !== "offer") {
    const o = d.offer;
    if (step === "ready" && d.hasPlan !== false) subject = b && back ? `${back} — your cancellation kit is ready` : `${o.percentOff}% off your cancellation kit`;
    preheader = `${o.price} instead of ${o.fullPrice}. Discount applied automatically.`;
    body.splice(1, 0, paragraph(`<strong>${o.percentOff}% off your cancellation kit:</strong> <s>${esc(o.fullPrice)}</s> <strong>${esc(o.price)}</strong>. Applied automatically when you open your kit. Valid until ${esc(o.expires)}.`));
    text.splice(1, 0, `${o.percentOff}% off your cancellation kit: ${o.price} instead of ${o.fullPrice}. Applied automatically. Valid until ${o.expires}.`);
  }

  return {
    subject,
    html: wrap({ preheader, bodyHtml: body.join(""), unsubscribeUrl: d.unsubscribeUrl }),
    text: [...text, textFooter(d.unsubscribeUrl)].join("\n"),
  };
}

// ---------------------------------------------------------------------------
// 4a. Abandoned checkout (lib/email/drip.ts dueCheckoutEmail). One email, no
//     discount: a reminder, the guarantee, and a way to tell us what broke.
// ---------------------------------------------------------------------------

export function checkoutEmail(d: {
  firstName?: string | null;
  estimate?: string | null;
  products: string[];
  /** Full kit price, e.g. "$19". */
  price: string;
  kitUrl: string;
  unsubscribeUrl: string;
}) {
  const hi = d.firstName ? `Hi ${esc(d.firstName)},` : "Hi,";
  const est = d.estimate ? (d.estimate.startsWith("up to") ? ` (${esc(d.estimate)} in refunds)` : ` (an estimated ${esc(d.estimate)} in refunds)`) : "";
  const subject = "Did something go wrong at checkout?";
  const list = d.products.length
    ? `<ul style="margin:0 0 16px;padding-left:20px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#3d4a44;">${d.products.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>`
    : "";
  const body = [
    paragraph(hi),
    paragraph(`You started checking out for your cancellation kit${est} but didn't finish. Your kit is saved, with each product matched to the company that handles it:`),
    list,
    `<div style="margin:0 0 16px;">${button({ label: `Finish getting my kit — ${d.price}`, href: d.kitUrl, primary: true })}</div>`,
    paragraph("If something went wrong — the payment page, a question about what you get, anything — just reply to this email. A person reads every reply."),
    paragraph(`<span style="color:#6b7a73;font-size:14px;">30-day no-questions refund, and if no refund arrives within 120 days, we give you your money back. The link opens your kit on any device — no password.</span>`),
  ];
  const text = [
    hi,
    "",
    `You started checking out for your cancellation kit${d.estimate ? ` (${d.estimate} in refunds)` : ""} but didn't finish. Your kit is saved:`,
    ...d.products.map((p) => `- ${p}`),
    "",
    `Finish getting my kit (${d.price}): ${d.kitUrl}`,
    "",
    "If something went wrong, just reply to this email. A person reads every reply.",
    "30-day no-questions refund, and money back if no refund arrives within 120 days.",
  ];
  return {
    subject,
    html: wrap({ preheader: "Your kit is saved. Reply if something went wrong.", bodyHtml: body.join(""), unsubscribeUrl: d.unsubscribeUrl }),
    text: [...text, textFooter(d.unsubscribeUrl)].join("\n"),
  };
}

// ---------------------------------------------------------------------------
// 4b. "It may be easier than you think" — after a Done-for-you click
//     (lib/email/drip.ts dueDfyEmail)
// ---------------------------------------------------------------------------

export interface DfyData {
  firstName?: string | null;
  estimate?: string | null;
  /** Plan's first steps, e.g. ["GAP coverage: form", "Extended warranty (VSC): call"] */
  firstSteps: string[];
  /** "$19", or null when their kit is free. */
  kitPrice: string | null;
  offer?: { percentOff: number; expires: string; fullPrice: string } | null;
  /** What Done for you would have cost, e.g. "$499". */
  dfyPrice: string;
  kitUrl: string;
  unsubscribeUrl: string;
}

/** What each first step actually asks of them, in plain words. */
const METHOD_EFFORT: Record<string, string> = {
  call: "one phone call — your kit has the number and what to say",
  form: "one form — the company's own, already filled in for you",
  dealer: "one call to the dealership's finance office — your kit has their number and what to ask for",
  lender: "one call to your lender — your kit has who to ask for and what to say",
  notarized: "one form and a notary stamp — usually free at your bank",
  mail: "one signed letter in the mail — already written for you",
  claim: "opening a GAP claim — your kit walks you through it",
  records: "a request for copies of your contracts — already written for you",
};

export function dfyEmail(d: DfyData) {
  const hi = d.firstName ? `Hi ${esc(d.firstName)},` : "Hi,";
  const steps = d.firstSteps
    .map((s) => {
      const i = s.lastIndexOf(":");
      const label = i > 0 ? s.slice(0, i).trim() : s;
      const effort = METHOD_EFFORT[i > 0 ? s.slice(i + 1).trim() : ""];
      return effort ? { label, effort } : null;
    })
    .filter(Boolean) as { label: string; effort: string }[];
  const est = d.estimate ? (d.estimate.startsWith("up to") ? ` (${esc(d.estimate)})` : ` (an estimated ${esc(d.estimate)})`) : "";
  const priceLine = d.kitPrice
    ? `That's exactly what we'd do for you — and your cancellation kit gives you the same steps for <strong>${esc(d.kitPrice)}</strong> instead of ${esc(d.dfyPrice)}.`
    : `That's exactly what we'd do for you — and your cancellation kit, with the same steps, is <strong>free</strong>.`;
  const cta = d.kitPrice ? `Get my kit for ${d.kitPrice}` : "Open my free kit";

  const body = [
    paragraph(hi),
    paragraph(`Thanks for asking about Done for you. Before you pay someone ${esc(d.dfyPrice)} to cancel your add-ons${est}: it's probably easier than you think.`),
    steps.length
      ? paragraph("Here's what each of yours actually takes:") +
        `<ul style="${UL}">${steps.map((x) => `<li style="margin-bottom:6px;"><strong>${esc(x.label)}</strong>: ${esc(x.effort)}.</li>`).join("")}</ul>`
      : paragraph("For most people it's one phone call or one form per product. Your kit has the number, what to say, and the paperwork filled in."),
    paragraph(priceLine),
    ...(d.offer ? [paragraph(`<strong>${d.offer.percentOff}% off</strong>: <s>${esc(d.offer.fullPrice)}</s> ${esc(d.kitPrice ?? "")}. Applied automatically. Valid until ${esc(d.offer.expires)}.`)] : []),
    `<div style="margin:0 0 16px;">${button({ label: cta, href: d.kitUrl, primary: true })}</div>`,
    ...(d.kitPrice
      ? [paragraph(`<span style="color:#6b7a73;font-size:14px;">If no refund arrives within 120 days, email us and we'll give you your money back. The link opens your kit on any device — no password.</span>`)]
      : [paragraph(`<span style="color:#6b7a73;font-size:14px;">The link opens your kit on any device — no password.</span>`)]),
    paragraph(`<span style="color:#6b7a73;font-size:14px;">Still rather we handle it? Reply to this email and we'll talk it through.</span>`),
  ];

  const text = [
    hi,
    "",
    `Thanks for asking about Done for you. Before you pay someone ${d.dfyPrice} to cancel your add-ons: it's probably easier than you think.`,
    "",
    ...(steps.length
      ? ["Here's what each of yours actually takes:", ...steps.map((x) => `- ${x.label}: ${x.effort}.`)]
      : ["For most people it's one phone call or one form per product. Your kit has the number, what to say, and the paperwork filled in."]),
    "",
    priceLine.replace(/<[^>]+>/g, ""),
    ...(d.offer ? [`${d.offer.percentOff}% off ${d.offer.fullPrice}. Applied automatically. Valid until ${d.offer.expires}.`] : []),
    "",
    `${cta}: ${d.kitUrl}`,
    "",
    "Still rather we handle it? Reply to this email and we'll talk it through.",
  ];

  return {
    subject: "It may be easier than you think",
    html: wrap({ preheader: "Most of these cancel with one call or one form.", bodyHtml: body.join(""), unsubscribeUrl: d.unsubscribeUrl }),
    text: [...text, textFooter(d.unsubscribeUrl)].join("\n"),
  };
}

// ---------------------------------------------------------------------------
// 5. "Get your paperwork" reminders (lib/email/drip.ts duePaperworkStep)
// ---------------------------------------------------------------------------

export interface PaperworkData {
  firstName?: string | null;
  estimate?: string | null;
  /** What's waiting on the paperwork, e.g. ["GAP coverage", "Extended warranty (VSC)"]; empty when unknown. */
  products: string[];
  dealerName?: string | null;
  dealerPhone?: string | null;
  /** Signs them in and opens the upload step. */
  uploadUrl: string;
  unsubscribeUrl: string;
}

const UL = `margin:0 0 16px;padding-left:20px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#3d4a44;`;

export function paperworkEmail(step: import("./drip").PaperStep, d: PaperworkData) {
  const hi = d.firstName ? `Hi ${esc(d.firstName)},` : "Hi,";
  // "Extended warranty (VSC)" → "extended warranty"; "GAP coverage" keeps its capitals.
  const what = d.products
    .filter((p) => !/records request/i.test(p))
    .flatMap((p) => p.split(/\s*\+\s*/))
    .map((p) => p.replace(/\s*\(.*?\)/g, "").replace(/^(?!GAP)./, (c) => c.toLowerCase()));
  const yours = what.length ? (what.length === 1 ? `your ${what[0]}` : `your ${what.slice(0, -1).join(", ")} and ${what.at(-1)}`) : "your add-ons";
  const at = d.estimate ? (d.estimate.startsWith("up to") ? ` (${esc(d.estimate)})` : ` (an estimated ${esc(d.estimate)})`) : "";
  const dealer = d.dealerName ? esc(d.dealerName) : "the dealership";
  const phone = d.dealerPhone ? ` at ${esc(d.dealerPhone)}` : "";
  const cta = `<div style="margin:0 0 16px;">${button({ label: "Upload my paperwork", href: d.uploadUrl, primary: true })}</div>`;
  const note = paragraph(`<span style="color:#6b7a73;font-size:14px;">A phone photo of the right page is enough. The link signs you in on any device — no password.</span>`);

  let subject = "";
  let preheader = "";
  let body: string[] = [];
  let text: string[] = [];

  if (step === "paper1") {
    subject = "Found your car paperwork yet?";
    preheader = "One page tells us who holds your refund.";
    const where = [
      `Search your email for <strong>DocuSign</strong>, <strong>RouteOne</strong>, <strong>Dealertrack</strong> or ${d.dealerName ? `<strong>${dealer}</strong>` : "the dealership's name"}.`,
      "Log in to your lender's website or app — look under Documents.",
      `Or call ${dealer}'s finance office${phone} and ask them to email you copies of everything you signed.`,
    ];
    body = [
      paragraph(hi),
      paragraph(`To finish your cancellation kit for ${esc(yours)}${at}, we need your contract — it names the company that holds your refund. The quickest ways to find it:`),
      `<ul style="${UL}">${where.map((w) => `<li style="margin-bottom:6px;">${w}</li>`).join("")}</ul>`,
      cta,
      note,
    ];
    text = [hi, "", `To finish your cancellation kit for ${yours}, we need your contract. Quickest ways to find it:`, `- Search your email for DocuSign, RouteOne, Dealertrack or ${d.dealerName ?? "the dealership's name"}.`, "- Log in to your lender's website or app (Documents).", `- Or call ${d.dealerName ?? "the dealership"}'s finance office${d.dealerPhone ? ` at ${d.dealerPhone}` : ""} and ask for copies.`, "", `Upload my paperwork: ${d.uploadUrl}`];
  } else if (step === "paper2") {
    subject = "If the dealer hasn't sent your contracts";
    preheader = "What to say so they email them today.";
    const say = `Hi, I bought a car from you and need copies of everything I signed — the finance contract and the add-on contracts. Can you email them to me today?`;
    body = [
      paragraph(hi),
      paragraph(`Dealers sometimes sit on these requests. Ask for the <strong>finance (F&amp;I) office</strong> or <strong>accounting</strong>${phone ? ` — ${dealer}${phone}` : ""} — and say:`),
      `<blockquote style="margin:0 0 16px;padding:12px 16px;border-left:3px solid #d9d9d3;background:#f6f6f3;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1d2a24;">${esc(say)}</blockquote>`,
      paragraph("If they stall, the written request in your kit puts it on the record. As soon as you have the pages, upload them:"),
      cta,
      note,
    ];
    text = [hi, "", "Dealers sometimes sit on these requests. Call the finance (F&I) office or accounting and say:", `"${say}"`, "", "If they stall, send the written request from your kit.", "", `Upload my paperwork: ${d.uploadUrl}`];
  } else {
    subject = "Your refund is waiting on one page";
    preheader = "Refunds shrink every month the contract runs.";
    body = [
      paragraph(hi),
      paragraph(`Last reminder from us: your refund on ${esc(yours)}${at} is waiting on one page of your contract. These refunds are worked out from the time left on the contract, so they get a little smaller every month.`),
      cta,
      note,
    ];
    text = [hi, "", `Last reminder: your refund on ${yours} is waiting on one page of your contract. Refunds get smaller every month.`, "", `Upload my paperwork: ${d.uploadUrl}`];
  }

  return {
    subject,
    html: wrap({ preheader, bodyHtml: body.join(""), unsubscribeUrl: d.unsubscribeUrl }),
    text: [...text, textFooter(d.unsubscribeUrl)].join("\n"),
  };
}
