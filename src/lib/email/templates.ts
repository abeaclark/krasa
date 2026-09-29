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
  offer?: { code: string; expires: string; url: string; price: string; fullPrice: string } | null;
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
  const list = d.products.length
    ? `<ul style="margin:0 0 16px;padding-left:20px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#3d4a44;">${d.products.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>`
    : "";
  const cta = (label: string, href: string) => `<div style="margin:0 0 16px;">${button({ label, href, primary: true })}</div>`;
  const est = d.estimate ? ` — an estimated <strong>${esc(d.estimate)}</strong>` : "";

  let subject = "";
  let preheader = "";
  let body: string[] = [];
  let text: string[] = [];

  if (step === "ready") {
    subject = "Your cancellation kit is ready";
    preheader = "Who to contact for each product, and your paperwork filled in.";
    body = [
      paragraph(hi),
      paragraph(`Your cancellation kit is ready${est} in refunds at stake. We've matched each product to the company that handles it:`),
      list,
      cta("Open my kit", d.kitUrl),
      paragraph(`<span style="color:#6b7a73;font-size:14px;">The link opens your kit on any device — no password.</span>`),
    ];
    text = [hi, "", `Your cancellation kit is ready${d.estimate ? ` — an estimated ${d.estimate} in refunds at stake` : ""}.`, ...d.products.map((p) => `- ${p}`), "", `Open my kit: ${d.kitUrl}`];
  } else if (step === "shrinks") {
    subject = d.fullRefundUntil ? `You may still get a full refund — until about ${d.fullRefundUntil}` : "Your refund gets smaller every month";
    preheader = "Cancelling sooner means more money back.";
    const lead = d.fullRefundUntil
      ? `Your paperwork shows these were bought recently. Many contracts refund the <strong>whole price</strong> if you cancel within the first 30–60 days — for you that's until about <strong>${esc(d.fullRefundUntil)}</strong>.`
      : "Refunds on these products are worked out from the time left on the contract. Every month you wait, the unused part — and your refund — gets smaller.";
    body = [paragraph(hi), paragraph(lead), paragraph("Your kit has everything ready to start today."), cta("Open my kit", d.kitUrl)];
    text = [hi, "", lead.replace(/<[^>]+>/g, ""), "", `Open my kit: ${d.kitUrl}`];
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
      cta("Open my kit", d.kitUrl),
    ];
    text = [hi, "", "How it works: one first step per product (a call or their form), sign the letter we filled in, most refunds arrive in 4-8 weeks.", "If no refund arrives within 120 days, email us and we'll give you your money back.", "", `Open my kit: ${d.kitUrl}`];
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
      cta("Open my kit", d.kitUrl),
    ];
    text = [hi, "", "Each of your products cancels a different way:", ...tips.map((t) => `- ${t.replace(/<[^>]+>/g, "")}`), "", `Open my kit: ${d.kitUrl}`];
  } else if (step === "offer" && d.offer) {
    const o = d.offer;
    subject = `30% off your cancellation kit — until ${o.expires}`;
    preheader = `${o.price} instead of ${o.fullPrice}. Code ${o.code}.`;
    body = [
      paragraph(hi),
      paragraph(`Here's 30% off your cancellation kit: <strong>${esc(o.price)}</strong> instead of ${esc(o.fullPrice)}${est ? `, with${est} at stake` : ""}.`),
      paragraph(`Your code <strong>${esc(o.code)}</strong> is applied automatically from the button below. It's just for you and works until <strong>${esc(o.expires)}</strong>.`),
      cta(`Get my kit for ${o.price}`, o.url),
      paragraph(`<span style="color:#6b7a73;font-size:14px;">Still covered by our promise: no refund within 120 days, your money back.</span>`),
    ];
    text = [hi, "", `30% off your cancellation kit: ${o.price} instead of ${o.fullPrice}.`, `Code ${o.code} — works until ${o.expires}.`, "", `Get my kit: ${o.url}`];
  }

  return {
    subject,
    html: wrap({ preheader, bodyHtml: body.join(""), unsubscribeUrl: d.unsubscribeUrl }),
    text: [...text, textFooter(d.unsubscribeUrl)].join("\n"),
  };
}
