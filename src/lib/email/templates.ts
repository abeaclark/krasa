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
}) {
  const hi = opts.firstName ? `Hi ${esc(opts.firstName)},` : "Hi,";
  const n = opts.letters.length;
  const subject =
    n === 1 ? "Your cancellation letter is ready" : `Your ${n} cancellation letters are ready`;

  const list = opts.letters
    .map(
      (l) => `<tr><td style="padding:0 0 14px;">
        <p style="margin:0 0 3px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#131c18;">${esc(l.title)}</p>
        <p style="margin:0 0 6px;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#6b7a73;">Goes to ${esc(l.recipient)}</p>
        <a href="${l.url}" style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#15624a;">Download PDF</a>
      </td></tr>`,
    )
    .join("");

  const bodyHtml = [
    paragraph(hi),
    paragraph(
      n === 1
        ? "Here is the cancellation letter you generated. Print it, sign it, and send it to the address on the letter."
        : `Here are the ${n} cancellation letters you generated. Print them, sign them, and send each one to the address printed on it.`,
    ),
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;">${list}</table>`,
    paragraph(
      `These links work for ${opts.linkDays} days. Save the PDFs somewhere safe — that way you still have them if you need to send a second copy.`,
    ),
    `<p style="margin:24px 0 10px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#131c18;">Three things that make this work</p>`,
    `<ol style="margin:0 0 18px;padding-left:20px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#3d4a44;">
      <li style="margin-bottom:6px;">Send it with tracking. Certified mail with return receipt costs about $9 and gives you the date they received it, which is the date everything else is measured from.</li>
      <li style="margin-bottom:6px;">Include a copy of your purchase paperwork if you have it, and your payoff letter or bill of sale if the car is gone.</li>
      <li>Keep a copy of everything you send, including the signed letter itself.</li>
    </ol>`,
    paragraph(
      "Most refunds take four to eight weeks. If you have not heard anything after two weeks, call the number on the letter and ask them to confirm they received it.",
    ),
    paragraph(
      `<span style="color:#6b7a73;font-size:14px;">We will check in once your letters have had time to land, to ask whether the money actually arrived. One click, and it helps us know whether any of this works.</span>`,
    ),
  ].join("");

  const text = [
    hi,
    "",
    n === 1
      ? "Here is the cancellation letter you generated. Print it, sign it, and send it to the address on the letter."
      : `Here are the ${n} cancellation letters you generated. Print them, sign them, and send each to the address printed on it.`,
    "",
    ...opts.letters.map((l) => `${l.title}\n  Goes to ${l.recipient}\n  ${l.url}`),
    "",
    `These links work for ${opts.linkDays} days. Save the PDFs somewhere safe.`,
    "",
    "Three things that make this work:",
    "1. Send it with tracking — certified mail with return receipt gives you the date they received it.",
    "2. Include your purchase paperwork, and your payoff letter or bill of sale if the car is gone.",
    "3. Keep a copy of everything you send.",
    "",
    "Most refunds take four to eight weeks. If you have not heard anything after two weeks, call the number on the letter and confirm they received it.",
    textFooter(),
  ].join("\n");

  return {
    subject,
    html: wrap({
      preheader:
        n === 1 ? "Print it, sign it, send it with tracking." : "Print them, sign them, send with tracking.",
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
