import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSubscribe } from "@/lib/capture/core";
import { editionFor, parseProductContext } from "@/lib/capture/product";
import { memoryStore } from "@/lib/capture/store";
import { answer, subscribe, type SendFn } from "@/lib/capture/service";
import { runFollowups } from "@/lib/capture/followups";
import { CAMPAIGNS } from "@/lib/capture/campaigns";
import { SK_CHRISTMAS } from "@/lib/capture/campaignData";
import { buildRewardEmail } from "@/lib/email/reward";
import { brandFor } from "@/lib/email/brands";

// Fake addresses only — nothing here reaches Resend or a database.
const T0 = new Date("2026-11-20T19:00:00Z");
const H = 3_600_000;
const at = (hours: number) => new Date(T0.getTime() + hours * H);
const sk = brandFor("sunlightkids.com")!;

function ed(id: string, band: string | null, extra: Record<string, unknown> = {}) {
  return {
    id,
    title: "Hawaii Activity Book for Kids",
    edition: band ? `Ages ${band.replace("-", "–")}` : null,
    ageBand: band,
    url: `/products/${id}`,
    amazonUrl: `/go/amazon/${id}`,
    pdfUrl: `/products/${id}#buy`,
    price: 9.99,
    pdfPrice: 4.99,
    image: `/api/email/cover/${id}`,
    pitch: "Aloha! 100+ pages of screen-free fun.",
    inside: ["Coloring pages", "Mazes", "Word searches"],
    ...extra,
  };
}

const PRODUCT = {
  rank: "exact",
  main: ed("hawaii-4-7", "4-7"),
  editions: [ed("hawaii-2-5", "2-5"), ed("hawaii-4-7", "4-7"), ed("hawaii-7-plus", "7+")],
  bonus: { title: "Road Trip Games", pdf: "/printables/road-trip-games.pdf", line: "Six car games. 14-page PDF." },
  quote: { text: "So many fun activities and they're educational, too!", by: "Julia R., on the Hawaii Activity Book" },
};

function body(email: string, over: Record<string, unknown> = {}) {
  return {
    site: "sunlightkids.com",
    email,
    offer: "sk-freebie",
    variant: "A",
    page: "/hawaii-with-kids",
    device: "mobile",
    tz: "America/Chicago",
    country: "US",
    consent: { text: "We'll email your pack, plus occasional tips.", euCheckbox: null },
    reward: {
      type: "download",
      title: "Airplane Activity Pack",
      thing: "pack",
      offerLine: "Quiet activities for the flight.",
      pdf: "/printables/airplane-activity-pack.pdf",
      product: PRODUCT,
    },
    utm: {},
    ...over,
  };
}

function harness() {
  const store = memoryStore();
  const sent: { to: string; subject: string; html: string; text: string }[] = [];
  let fail = false;
  const send: SendFn = async (o) => {
    if (fail) return { ok: false, error: "boom" };
    sent.push(o);
    return { ok: true, id: `re_${sent.length}` };
  };
  const run = (now: Date, extra = {}) =>
    runFollowups(store, send, now, { gapMs: 0, sleep: async () => {}, campaigns: [], ...extra });
  return { store, sent, send, run, setFail: (v: boolean) => (fail = v) };
}

test("product: parsed, kept with the title they received; junk is dropped, not fatal", () => {
  const ok = parseSubscribe(body("a@example.com"), T0);
  assert.ok(ok.ok);
  assert.equal(ok.input.reward.product?.main.title, "Hawaii Activity Book for Kids");
  assert.equal(ok.input.reward.product?.editions.length, 3);
  assert.equal(ok.input.reward.product?.received, "Airplane Activity Pack");

  const junk = parseSubscribe(body("b@example.com", { reward: { ...body("x").reward, product: { main: { title: "" } } } }), T0);
  assert.ok(junk.ok);
  assert.equal(junk.input.reward.product, null);
  assert.equal(parseProductContext("nope"), null);
});

test("editions: the age answer picks the edition; 'A mix' or none keeps the page's book", () => {
  const ctx = parseProductContext(PRODUCT)!;
  assert.equal(editionFor(ctx, "2–5").id, "hawaii-2-5");
  assert.equal(editionFor(ctx, "7+").id, "hawaii-7-plus");
  assert.equal(editionFor(ctx, "A mix").id, "hawaii-4-7");
  assert.equal(editionFor(ctx, null).id, "hawaii-4-7");
});

test("welcome email: the matched book under the download, brand links only, not for opted-out", () => {
  const parsed = parseSubscribe(body("c@example.com"), T0);
  assert.ok(parsed.ok);
  const base = { brand: sk, links: { pdf: "https://www.sunlightkids.com/printables/airplane-activity-pack.pdf", checkout: null }, token: "tok", tz: null };
  const mail = buildRewardEmail({ ...base, reward: parsed.input.reward, marketing: true });
  assert.match(mail.html, /Want more like this\?/);
  assert.match(mail.html, /https:\/\/www\.sunlightkids\.com\/go\/amazon\/hawaii-4-7/);
  assert.match(mail.html, /Get the paperback · \$9\.99/);
  assert.match(mail.html, /download &amp; print it at home · \$4\.99/);
  assert.match(mail.text, /About the book: https:\/\/www\.sunlightkids\.com\/products\/hawaii-4-7/);
  assert.ok(mail.html.indexOf("Download Airplane Activity Pack") < mail.html.indexOf("Want more like this?"));

  const quiet = buildRewardEmail({ ...base, reward: parsed.input.reward, marketing: false });
  assert.doesNotMatch(quiet.html, /Want more like this/);

  // An off-domain button is dropped; an off-domain book page drops the whole block.
  const off = structuredClone(parsed.input.reward);
  off.product!.main.amazonUrl = "https://www.amazon.com/dp/B0";
  const m2 = buildRewardEmail({ ...base, reward: off, marketing: true });
  assert.doesNotMatch(m2.html, /amazon\.com/);
  assert.match(m2.html, /Download &amp; print · \$4\.99/);
  off.product!.main.url = "https://evil.example/x";
  assert.doesNotMatch(buildRewardEmail({ ...base, reward: off, marketing: true }).html, /Want more like this/);
});

test("sequence: day 2, 5 and 9 go out once each, on time, in the answered age edition", async () => {
  const h = harness();
  const r = await subscribe(h.store, body("parent@example.com"), h.send, T0);
  assert.equal(r.status, 200);
  await answer(h.store, { token: r.body.token, question: "How old are your kids?", answer: "7+" });
  h.sent.length = 0; // drop the welcome email

  await h.run(at(47));
  assert.equal(h.sent.length, 0, "not before day 2");

  await h.run(at(49));
  assert.equal(h.sent.length, 1);
  assert.match(h.sent[0].subject, /Another free printable: Road Trip Games/);
  assert.match(h.sent[0].html, /We hope the Airplane Activity Pack went over well/);
  assert.match(h.sent[0].html, /road-trip-games\.pdf/);
  assert.match(h.sent[0].html, /hawaii-7-plus/, "links the 7+ edition");
  assert.match(h.sent[0].text, /Unsubscribe: https:\/\/www\.sunlightkids\.com\/api\/subscribe\/unsubscribe\//);

  await h.run(at(50));
  assert.equal(h.sent.length, 1, "never twice");

  await h.run(at(121));
  assert.equal(h.sent.length, 2);
  assert.match(h.sent[1].subject, /Hawaii Activity Book for Kids: paperback or print at home/);
  assert.match(h.sent[1].html, /Hawaii Activity Book for Kids \(Ages 7\+\)/);
  assert.match(h.sent[1].html, /What&#39;s inside|What's inside/);

  await h.run(at(217));
  assert.equal(h.sent.length, 3);
  assert.match(h.sent[2].subject, /^"So many fun activities and they're educational, too"$/);
  assert.match(h.sent[2].html, /Different ages at home\?/);
  assert.match(h.sent[2].html, /hawaii-2-5/);
  assert.doesNotMatch(h.sent[2].html, /Different ages[\s\S]*hawaii-7-plus#/, "their own edition isn't in the others list");

  await h.run(at(400));
  assert.equal(h.sent.length, 3);
});

test("sequence: late steps are dropped, buyers aren't pitched, opted-out and unsubscribed get nothing", async () => {
  const h = harness();
  await subscribe(h.store, body("late@example.com"), h.send, T0);
  await subscribe(h.store, body("buyer@example.com"), h.send, T0);
  await subscribe(h.store, body("eu@example.com", { country: "DE", consent: { text: "x", euCheckbox: false } }), h.send, T0);
  const gone = await subscribe(h.store, body("gone@example.com"), h.send, T0);
  h.store.subscribers.find((s) => s.token === gone.body.token)!.status = "unsubscribed";
  h.store.paidOrders.push({ email: "buyer@example.com", book_id: "hawaii-4-7" });
  h.sent.length = 0;

  // Cron was down until 130h: day 5 is due, day 2 is too late.
  const sum = await h.run(at(130));
  const to = h.sent.map((m) => `${m.to}|${m.subject}`);
  assert.ok(to.some((t) => t.startsWith("late@example.com|") && /paperback or print/.test(t)));
  assert.ok(!to.some((t) => t.startsWith("buyer@example.com|") && /paperback or print/.test(t)), "bought it: no pitch");
  assert.equal(sum.skipped["seq:d5-book"], 1);
  assert.ok(!to.some((t) => t.startsWith("eu@") || t.startsWith("gone@")));
  // At most one email per person per run: day 2 waits.
  assert.equal(h.sent.filter((m) => m.to === "late@example.com").length, 1);

  // Day 2 fell due at 48h; by 130h it is more than LATE_HOURS overdue and never goes.
  assert.ok(!h.sent.some((m) => /Another free printable/.test(m.subject)));
  // Nothing at all for someone first reached two weeks in.
  const h2 = harness();
  await subscribe(h2.store, body("stale@example.com"), h2.send, T0);
  h2.sent.length = 0;
  await h2.run(at(24 * 14));
  assert.equal(h2.sent.length, 0);
});

test("sequence: subscribers without a product context get no sequence", async () => {
  const h = harness();
  const b = body("plain@example.com");
  delete (b.reward as Record<string, unknown>).product;
  await subscribe(h.store, b, h.send, T0);
  h.sent.length = 0;
  for (const hours of [49, 121, 217]) await h.run(at(hours));
  assert.equal(h.sent.length, 0);
});

test("failed sends are released and retried next run", async () => {
  const h = harness();
  await subscribe(h.store, body("retry@example.com"), h.send, T0);
  h.sent.length = 0;
  h.setFail(true);
  const s1 = await h.run(at(49));
  assert.equal(s1.failed["seq:d2-bonus"], 1);
  h.setFail(false);
  await h.run(at(50));
  assert.equal(h.sent.length, 1);
});

test("campaigns: in window only, list as of sendAt, segmented by age", async () => {
  const bf = CAMPAIGNS.find((c) => c.id === "sk-2026-black-friday")!;
  const h = harness();
  const young = await subscribe(h.store, body("young@example.com"), h.send, T0);
  await answer(h.store, { token: young.body.token, question: "How old are your kids?", answer: "2–5" });
  const plain = body("noproduct@example.com");
  delete (plain.reward as Record<string, unknown>).product;
  await subscribe(h.store, plain, h.send, T0);
  await subscribe(h.store, body("eu@example.com", { country: "FR", consent: { text: "x", euCheckbox: false } }), h.send, T0);
  // Joins after the send started: gets the sequence, not the broadcast.
  await subscribe(h.store, body("late-joiner@example.com"), h.send, new Date(bf.sendAt.getTime() + H));
  h.sent.length = 0;

  const opts = { campaigns: [bf], sequences: {} };
  await h.run(new Date(bf.sendAt.getTime() - H), opts);
  assert.equal(h.sent.length, 0, "not before sendAt");

  await h.run(new Date(bf.sendAt.getTime() + 2 * H), opts);
  const byTo = Object.fromEntries(h.sent.map((m) => [m.to, m]));
  assert.deepEqual(Object.keys(byTo).sort(), ["noproduct@example.com", "young@example.com"]);
  assert.equal(byTo["young@example.com"].subject, "Christmas books and games for kids, by age");
  assert.doesNotMatch(byTo["young@example.com"].html, new RegExp(SK_CHRISTMAS.book.title), "6–12 book not shown to 2–5");
  assert.match(byTo["young@example.com"].html, new RegExp(SK_CHRISTMAS.pack.title));
  assert.match(byTo["young@example.com"].html, /hawaii-2-5/, "their own book, in their age edition");
  assert.match(byTo["young@example.com"].html, /gifts-for-3-year-olds/);
  assert.match(byTo["noproduct@example.com"].html, new RegExp(SK_CHRISTMAS.book.title));
  assert.match(byTo["noproduct@example.com"].html, /Gift guides for every age/);

  await h.run(new Date(bf.sendAt.getTime() + 3 * H), opts);
  assert.equal(h.sent.length, 2, "once each");
  await h.run(bf.until, opts);
  assert.equal(h.sent.length, 2);
});

test("last-minute campaign is PDF-only: no Amazon buttons", async () => {
  const lm = CAMPAIGNS.find((c) => c.id === "sk-2026-last-minute-pdf")!;
  const h = harness();
  await subscribe(h.store, body("pdf@example.com"), h.send, T0);
  h.sent.length = 0;
  await h.run(new Date(lm.sendAt.getTime() + H), { campaigns: [lm], sequences: {} });
  assert.equal(h.sent.length, 1);
  assert.doesNotMatch(h.sent[0].html, /go\/amazon/);
  assert.match(h.sent[0].html, /Download &amp; print · \$4\.99/);
});
