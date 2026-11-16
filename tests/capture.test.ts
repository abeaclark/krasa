import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createHmac } from "node:crypto";
import { formatExpiry, hstDay, hstYesterday, parseSubscribe, pickOffer } from "@/lib/capture/core";
import { memoryStore } from "@/lib/capture/store";
import { answer, assign, event, subscribe, unsubscribe, type SendFn } from "@/lib/capture/service";
import { buildRewardEmail } from "@/lib/email/reward";
import { brandFor, brandUrl, brandForFrom, BRANDS } from "@/lib/email/brands";
import { buildDigest } from "@/lib/capture/digest";
import { statusForEvent, verifySvix } from "@/lib/capture/resendWebhook";
import { SITES } from "@/lib/enums";

// Fake addresses only — nothing here reaches Resend, Slack or a database.
const NOW = new Date("2026-11-13T19:32:00Z"); // 9:32 AM HST
const sent: { to: string; subject: string; html: string; text: string; unsubscribeUrl: string }[] = [];
const send: SendFn = async (o) => {
  sent.push(o);
  return { ok: true, id: "test" };
};

function body(over: Record<string, unknown> = {}) {
  return {
    site: "sunlightkids.com",
    email: "Parent+Test@Example.com",
    offer: "sk-freebie",
    variant: "A",
    page: "/books",
    device: "mobile",
    tz: "America/New_York",
    country: "US",
    consent: { text: "We'll email your pack, plus occasional tips.", euCheckbox: null },
    reward: {
      type: "download",
      title: "Airplane Activity Pack",
      thing: "pack",
      offerLine: "12 pages of quiet activities for the flight.",
      pdf: "/printables/airplane-activity-pack.pdf",
    },
    utm: { utm_source: "pinterest" },
    ...over,
  };
}

test("sites: the five new brands are known, the old ones kept", () => {
  for (const s of ["practicetesthq.com", "teacherexamhq.com", "realestateexamhq.com", "solvedparty.com", "sunday101.com", "refundauto.com", "krasadev.com"]) {
    assert.ok((SITES as readonly string[]).includes(s), s);
  }
  for (const b of Object.values(BRANDS)) {
    assert.match(b!.from, /<hello@mail\./);
    assert.ok(b!.postalAddress && b!.legalName);
  }
});

test("assignment: round robin is fair and ties go by list order", async () => {
  const store = memoryStore();
  const offers = ["a", "b", "c"];
  const picks: string[] = [];
  for (let i = 0; i < 300; i++) picks.push((await assign(store, { site: "sunday101.com", offers })).body.offer as string);
  assert.deepEqual(picks.slice(0, 6), ["a", "b", "c", "a", "b", "c"]);
  for (const id of offers) assert.equal(picks.filter((p) => p === id).length, 100);

  // A new offer joins at 0 and catches up before the others get another turn.
  const next = (await assign(store, { site: "sunday101.com", offers: [...offers, "d"] })).body.offer;
  assert.equal(next, "d");
  // Only the listed (available) offers are considered.
  assert.equal((await assign(store, { site: "sunday101.com", offers: ["b"] })).body.offer, "b");
  // Counters are per site.
  assert.equal((await assign(store, { site: "solvedparty.com", offers })).body.offer, "a");
  assert.equal(pickOffer(["x", "y"], { x: 2, y: 2 }), "x");
  assert.equal((await assign(store, { site: "nope.com", offers })).status, 400);
  assert.equal((await assign(store, { site: "sunday101.com", offers: [] })).status, 400);
});

test("events: view/close/click land on the HST day", async () => {
  const store = memoryStore();
  await event(store, { site: "sunlightkids.com", offer: "sk-freebie", event: "view", device: "mobile" }, NOW);
  await event(store, { site: "sunlightkids.com", offer: "sk-freebie", event: "view", device: "mobile" }, NOW);
  await event(store, { site: "sunlightkids.com", offer: "sk-freebie", event: "close", device: "mobile" }, NOW);
  await event(store, { site: "sunlightkids.com", offer: "sk-freebie", event: "click", device: "desktop" }, NOW);
  assert.equal((await event(store, { site: "sunlightkids.com", offer: "x", event: "signup", device: "mobile" }, NOW)).status, 400);
  const m = store.statRows.find((r) => r.device === "mobile")!;
  assert.deepEqual([m.day, m.views, m.closes, m.clicks], ["2026-11-13", 2, 1, 0]);
  assert.equal(store.statRows.find((r) => r.device === "desktop")!.clicks, 1);
  // 08:00 UTC is still the previous evening in Honolulu.
  assert.equal(hstDay(new Date("2026-11-14T08:00:00Z")), "2026-11-13");
  assert.equal(hstYesterday(new Date("2026-11-14T18:00:00Z")), "2026-11-13");
});

test("subscribe: stores one row, counts the signup, sends the download email", async () => {
  sent.length = 0;
  const store = memoryStore();
  const r = await subscribe(store, body(), send, NOW);
  assert.equal(r.status, 200);
  assert.equal(store.subscribers.length, 1);
  const row = store.subscribers[0];
  assert.equal(row.email, "parent+test@example.com");
  assert.equal(r.body.token, row.token);
  assert.equal(store.statRows[0].signups, 1);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].subject, "Your free pack: Airplane Activity Pack");
  assert.match(sent[0].html, /https:\/\/www\.sunlightkids\.com\/printables\/airplane-activity-pack\.pdf/);
  assert.match(sent[0].html, /Download Airplane Activity Pack/);
  assert.match(sent[0].html, /PO Box 186, Hanalei, HI 96714/);
  assert.equal(sent[0].unsubscribeUrl, `https://www.sunlightkids.com/api/subscribe/unsubscribe/${row.token}`);
  assert.match(sent[0].text, /Unsubscribe: https:\/\/www\.sunlightkids\.com\/api\/subscribe\/unsubscribe\//);
  assert.match(sent[0].text, /From time to time we'll also send tips and offers/);
});

test("subscribe: a repeat signup updates the row and re-sends, no second row or count", async () => {
  sent.length = 0;
  const store = memoryStore();
  const first = await subscribe(store, body(), send, NOW);
  const again = await subscribe(store, body({ page: "/gifts", email: "parent+test@example.com " }), send, NOW);
  assert.equal(store.subscribers.length, 1);
  assert.equal(again.body.token, first.body.token);
  assert.equal(store.subscribers[0].page, "/gifts");
  assert.equal(store.statRows[0].signups, 1);
  assert.equal(sent.length, 2);
  // Same email on another site is a separate subscriber.
  await subscribe(store, body({ site: "sunday101.com", reward: { type: "list", title: "Weekly lesson" } }), send, NOW);
  assert.equal(store.subscribers.length, 2);
});

test("subscribe: validation, honeypot, and links must be on the brand's domain", async () => {
  sent.length = 0;
  const store = memoryStore();
  assert.equal((await subscribe(store, body({ email: "nope" }), send, NOW)).status, 400);
  assert.equal((await subscribe(store, body({ site: "evil.com" }), send, NOW)).status, 400);
  assert.equal((await subscribe(store, body({ consent: {} }), send, NOW)).status, 400);
  const evil = body({ reward: { type: "download", title: "X", pdf: "https://evil.example/x.pdf" } });
  assert.equal((await subscribe(store, evil, send, NOW)).status, 400);
  const hp = await subscribe(store, body({ company: "Acme" }), send, NOW);
  assert.deepEqual([hp.status, hp.body.token], [200, null]);
  assert.equal(store.subscribers.length, 0);
  assert.equal(sent.length, 0);
  const b = brandFor("sunlightkids.com")!;
  assert.equal(brandUrl(b, "/a.pdf"), "https://www.sunlightkids.com/a.pdf");
  assert.equal(brandUrl(b, "https://sunlightkids.com.evil.io/a.pdf"), null);
  assert.equal(brandUrl(b, "javascript:alert(1)"), null);
});

test("subscribe: unticked EU box stores marketing=false and drops the marketing line", async () => {
  sent.length = 0;
  const store = memoryStore();
  await subscribe(store, body({ country: "DE", consent: { text: "c", euCheckbox: false } }), send, NOW);
  assert.equal(store.subscribers[0].marketing, false);
  assert.doesNotMatch(sent[0].html, /tips and offers/);
  assert.doesNotMatch(sent[0].text, /tips and offers/);
  // The reward itself is still delivered, with unsubscribe + address.
  assert.match(sent[0].html, /Download Airplane Activity Pack/);
  assert.match(sent[0].html, /Unsubscribe/);
  const ticked = parseSubscribe(body({ consent: { text: "c", euCheckbox: true } }), NOW);
  assert.ok(ticked.ok && ticked.input.marketing);
});

test("code email: subject, exact local expiry, code link, no later-price talk", async () => {
  sent.length = 0;
  const store = memoryStore();
  const expiresAt = new Date(NOW.getTime() + 24 * 3_600_000).toISOString();
  const r = await subscribe(
    store,
    body({
      site: "practicetesthq.com",
      tz: "America/New_York",
      reward: {
        type: "code",
        title: "Your first week for $0.99",
        offerShort: "$0.99 first week",
        offerLine: "This code unlocks your first week of full access for $0.99.",
        checkoutHref: "/checkout?plan=weekly",
        code: { value: "WEEK99-K7M2", expiresAt },
      },
    }),
    send,
    NOW,
  );
  assert.equal(r.status, 200);
  const m = sent[0];
  assert.equal(m.subject, "Your $0.99 first week: code expires in 24 hours");
  assert.match(m.html, /WEEK99-K7M2/);
  assert.match(m.html, /Expires Sat, Nov 14 at 2:32 PM EST \(24 hours\)/);
  assert.match(m.html, /Use it by Sat, Nov 14 at 2:32 PM/);
  assert.match(m.html, /https:\/\/www\.practicetesthq\.com\/checkout\?plan=weekly&amp;code=WEEK99-K7M2/);
  assert.match(m.text, /can't be renewed/);
  assert.doesNotMatch(m.html + m.text, /cancel|per month|\/mo|renews/i);
  // Dead or far-future codes are refused.
  const dead = body({ reward: { type: "code", title: "t", code: { value: "A-1", expiresAt: "2026-11-13T00:00:00Z" } } });
  assert.equal((await subscribe(store, dead, send, NOW)).status, 400);
});

test("expiry formatting: Honolulu, New York, London, and the fallback", () => {
  const at = "2026-11-14T19:32:00Z";
  assert.equal(formatExpiry(at, "Pacific/Honolulu").full, "Sat, Nov 14 at 9:32 AM HST");
  assert.equal(formatExpiry(at, "America/New_York").full, "Sat, Nov 14 at 2:32 PM EST");
  assert.equal(formatExpiry(at, "Europe/London").full, "Sat, Nov 14 at 7:32 PM GMT");
  // Summer: New York is on daylight time; a late-evening UTC time is next day in London.
  assert.equal(formatExpiry("2027-07-04T23:30:00Z", "America/New_York").full, "Sun, Jul 4 at 7:30 PM EDT");
  assert.equal(formatExpiry("2027-07-04T23:30:00Z", "Europe/London").dayTime, "Mon, Jul 5 at 12:30 AM");
  assert.equal(formatExpiry(at, "Not/AZone").full, "Sat, Nov 14 at 9:32 AM HST");
  assert.equal(formatExpiry(at, null).abbr, "HST");
});

test("unsubscribe: idempotent, unknown token refused, re-signup reactivates", async () => {
  sent.length = 0;
  const store = memoryStore();
  const token = (await subscribe(store, body(), send, NOW)).body.token as string;
  const a = await unsubscribe(store, token, NOW);
  assert.deepEqual([a.status, a.body.brand], [200, "Sunlight Kids"]);
  const stamp = store.subscribers[0].unsubscribed_at;
  const b = await unsubscribe(store, token, new Date(NOW.getTime() + 60_000));
  assert.equal(b.status, 200);
  assert.equal(store.subscribers[0].status, "unsubscribed");
  assert.equal(store.subscribers[0].unsubscribed_at, stamp);
  assert.equal((await unsubscribe(store, "not-a-token", NOW)).status, 404);
  await subscribe(store, body(), send, NOW);
  assert.equal(store.subscribers[0].status, "active");
});

test("answers merge; bounces and complaints stop mail", async () => {
  sent.length = 0;
  const store = memoryStore();
  const token = (await subscribe(store, body(), send, NOW)).body.token as string;
  await answer(store, { token, question: "How old are your kids?", answer: "4–7" });
  await answer(store, { token, question: "second", answer: "x" });
  assert.deepEqual(store.subscribers[0].answers, { "How old are your kids?": "4–7", second: "x" });
  assert.equal((await answer(store, { token: "nope", question: "q", answer: "a" })).status, 404);

  assert.equal(statusForEvent("email.bounced"), "bounced");
  assert.equal(statusForEvent("email.complained"), "complained");
  assert.equal(statusForEvent("email.delivered"), null);
  assert.equal(brandForFrom("Sunlight Kids <hello@mail.sunlightkids.com>")?.site, "sunlightkids.com");
  assert.equal(await store.setStatusByEmail("parent+test@example.com", "complained", "sunlightkids.com"), 1);
  const before = sent.length;
  const r = await subscribe(store, body(), send, NOW);
  assert.deepEqual([r.status, r.body.emailed], [200, false]);
  assert.equal(sent.length, before);
});

test("resend webhook signature", () => {
  const key = Buffer.from("super-secret-key");
  const secret = `whsec_${key.toString("base64")}`;
  const payload = JSON.stringify({ type: "email.bounced" });
  const ts = String(Math.floor(NOW.getTime() / 1000));
  const sig = createHmac("sha256", key).update(`msg_1.${ts}.${payload}`).digest("base64");
  const h = { id: "msg_1", timestamp: ts, signature: `v1,bogus v1,${sig}` };
  assert.equal(verifySvix(secret, h, payload, NOW.getTime()), true);
  assert.equal(verifySvix(secret, h, payload + " ", NOW.getTime()), false);
  assert.equal(verifySvix(secret, h, payload, NOW.getTime() + 3_600_000), false);
  assert.equal(verifySvix(secret, { ...h, signature: null }, payload, NOW.getTime()), false);
});

test("digest: one message, per site and offer, with signup rate", () => {
  const text = buildDigest("2026-11-12", [
    { site: "sunlightkids.com", offer_id: "sk-freebie", device: "mobile", day: "2026-11-12", views: 150, closes: 90, clicks: 4, signups: 9 },
    { site: "sunlightkids.com", offer_id: "sk-freebie", device: "desktop", day: "2026-11-12", views: 50, closes: 20, clicks: 1, signups: 3 },
    { site: "refundauto.com", offer_id: "ra-check", device: "desktop", day: "2026-11-12", views: 10, closes: 5, clicks: 2, signups: 0 },
  ])!;
  assert.match(text, /`sk-freebie` — 200 views · 12 signups · 5 clicks · 6\.0% signup rate/);
  assert.ok(text.indexOf("refundauto.com") < text.indexOf("sunlightkids.com"));
  assert.equal(buildDigest("2026-11-12", []), null);
});

test("reward emails escape what sites send", () => {
  const mail = buildRewardEmail({
    brand: brandFor("sunday101.com")!,
    reward: { type: "list", title: "<script>x</script>", thing: null, offerShort: null, offerLine: null, checkoutHref: null, pdf: null, code: null },
    links: { pdf: null, checkout: null },
    token: "t",
    tz: null,
    marketing: true,
  });
  assert.doesNotMatch(mail.html, /<script>/);
});

test("nothing in the capture code touches leads, the drip, or lead Slack pings", () => {
  const roots = ["src/lib/capture", "src/app/api/capture", "src/app/api/subscribe", "src/app/api/webhooks", "src/app/api/cron/capture-digest"];
  const files: string[] = ["src/lib/email/brands.ts", "src/lib/email/reward.ts", "src/lib/email/brandSend.ts"];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else files.push(p);
    }
  };
  roots.forEach(walk);
  assert.ok(files.length >= 14);
  for (const f of files) {
    const src = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""); // code only
    assert.doesNotMatch(src, /\bleads\b(?!-intake)/, `${f} references leads`);
    assert.doesNotMatch(src, /notifySlack|refreshLeadCard|email\/drip|email\/schedule|email\/templates/, `${f} reaches into lead email/Slack`);
  }
  // Existing lead routes are untouched by this work: they don't know capture exists.
  for (const f of ["src/app/api/leads/route.ts", "src/app/api/cron/drip-emails/route.ts", "src/app/api/cron/outcome-emails/route.ts"]) {
    assert.doesNotMatch(readFileSync(f, "utf8"), /capture|subscribers/);
  }
});
