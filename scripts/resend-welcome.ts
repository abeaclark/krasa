/**
 * Re-send the popup welcome email to subscribers who signed up while their
 * brand's mail was failing (Sunlight Kids, Nov 20–23 2026: popup mail went out
 * from mail.sunlightkids.com, which isn't verified in Resend).
 *
 *   ENV_FILE=.env.production npx tsx scripts/resend-welcome.ts --site sunlightkids.com --since 2026-11-20          # dry run
 *   ENV_FILE=.env.production npx tsx scripts/resend-welcome.ts --site sunlightkids.com --since 2026-11-20 --apply
 *
 * For each active subscriber since --since it asks the site which freebie (and
 * book) goes with the page they signed up on (GET /api/capture/freebie?path=…
 * &product=1), saves the book as their `context` so the follow-up sequence
 * picks them up, and sends the welcome email. Each person is claimed once in
 * capture_sends ("welcome-resend"), so running it twice never double-sends.
 * Needs DATABASE_URL and the brand's Resend key in the env file.
 */
import * as dotenv from "dotenv";

dotenv.config({ path: process.env.ENV_FILE || ".env" });

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const site = arg("site") ?? "sunlightkids.com";
const since = arg("since");
const apply = process.argv.includes("--apply");
if (!since || !/^\d{4}-\d{2}-\d{2}$/.test(since)) {
  console.error("--since YYYY-MM-DD is required");
  process.exit(2);
}

async function main() {
  const { client: sql } = await import("@/lib/db/client");
  const { brandFor, brandUrl, unsubscribeUrl } = await import("@/lib/email/brands");
  const { buildRewardEmail } = await import("@/lib/email/reward");
  const { sendBrandEmail } = await import("@/lib/email/brandSend");
  const { parseProductContext } = await import("@/lib/capture/product");

  const brand = brandFor(site);
  if (!brand) throw new Error(`no brand for ${site}`);
  const KEY = "welcome-resend";

  type Row = { id: string; email: string; page: string | null; tz: string | null; marketing: boolean; token: string; context: unknown };
  const sinceDay = since as string;
  const rows = (await sql`
    select s.id, s.email, s.page, s.tz, s.marketing, s.token, s.context from subscribers s
    where s.site = ${site} and s.status = 'active' and s.created_at >= ${sinceDay}::date
      and not exists (select 1 from capture_sends c where c.subscriber_id = s.id and c.key = ${KEY})
    order by s.created_at`) as unknown as Row[];
  console.log(`${rows.length} subscriber(s) on ${site} since ${since}${apply ? "" : " (dry run)"}`);

  for (const r of rows) {
    const page = r.page ?? "/";
    const res = await fetch(`${brand.origin}/api/capture/freebie?path=${encodeURIComponent(page)}&product=1`);
    const data = (await res.json()) as {
      freebie: { title: string; thing: string; short: string; line: string; pdf: string } | null;
      product?: unknown;
    };
    const f = data.freebie;
    const pdf = f ? brandUrl(brand, f.pdf) : null;
    if (!f || !pdf) {
      console.log(`  skip ${r.email}: no freebie for ${page}`);
      continue;
    }
    const product = parseProductContext(data.product);
    const ctx = product ? { ...product, received: f.title } : null;
    console.log(`  ${r.email}  ${page}  →  ${f.title}${ctx ? ` + ${ctx.main.title}` : ""}`);
    if (!apply) continue;

    const claimed = await sql`insert into capture_sends (subscriber_id, key) values (${r.id}, ${KEY})
                              on conflict do nothing returning key`;
    if (!claimed.length) continue;
    if (ctx && !r.context) {
      await sql`update subscribers set context = ${JSON.stringify(ctx)}::text::jsonb, updated_at = now() where id = ${r.id}`;
    }
    const mail = buildRewardEmail({
      brand,
      reward: { type: "download", title: f.title, thing: f.thing, offerShort: f.short, offerLine: f.line, checkoutHref: null, pdf: f.pdf, code: null, product: ctx },
      links: { pdf, checkout: null },
      token: r.token,
      tz: r.tz,
      marketing: r.marketing,
    });
    const sent = await sendBrandEmail({ brand, to: r.email, subject: mail.subject, html: mail.html, text: mail.text, unsubscribeUrl: unsubscribeUrl(brand, r.token) });
    if (sent.ok) {
      await sql`update capture_sends set email_id = ${sent.id ?? null}, sent_at = now() where subscriber_id = ${r.id} and key = ${KEY}`;
      console.log(`    sent ${sent.id}`);
    } else {
      await sql`delete from capture_sends where subscriber_id = ${r.id} and key = ${KEY}`;
      console.log(`    FAILED: ${sent.error}`);
    }
    await new Promise((ok) => setTimeout(ok, 600));
  }
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
