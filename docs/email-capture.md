# Email-capture popup backend

The subscriber list, counters, offer assignment, reward emails and unsubscribe
for the popup that runs on eight sites. Spec:
`~/projects/porfolio/specs/email-capture/SPEC.md` (§6–§9).

**Hard rule:** popup signups never go into `leads`. The RefundAuto drip cron
emails every `refundauto.com` lead and every lead pings Slack; a popup signup
does neither. `tests/capture.test.ts` fails if capture code references leads.

## Routes

| Route | What it does |
|---|---|
| `POST /api/capture/assign` `{site, offers}` | Round robin: returns the listed offer handed out least (ties by list order) and counts it. |
| `POST /api/capture/event` `{site, offer, event, device}` | `view` / `close` / `click` → today's row in `capture_stats_daily` (Pacific/Honolulu day). Accepts `text/plain` (sendBeacon). |
| `POST /api/subscribe` | Validates, upserts the subscriber (one row per site + email; a repeat signup updates it and re-sends), counts the signup once, sends the reward email, returns `{ok, token}`. |
| `POST /api/subscribe/answer` `{token, question, answer}` | Merges the one-tap answer into `answers`. |
| `GET` / `POST /api/subscribe/unsubscribe/[token]` | Unsubscribes at once, idempotent. GET returns JSON for the brand site's page; POST is RFC 8058 one-click. |
| `POST /api/webhooks/resend` | `email.bounced` → `bounced`, `email.complained` → `complained` (Svix-signed). |
| `GET /api/cron/capture-digest` | 7:00 HST: one Slack message with yesterday's views, signups, clicks and signup rate per site and offer. |
| `GET /api/cron/capture-followups` | Every 30 min: due sequence steps, then any seasonal campaign in its window (below). |
| `GET /api/capture/report?since=YYYY-MM-DD` | Bearer `CAPTURE_REPORT_SECRET`. Stats rows + subscriber counts by site/status. |

## Rules worth knowing

- Links in a reward email must be on the brand's own domain (`brandUrl`); a
  relative path is resolved against `https://www.<domain>`. Anything else is a 400.
- `marketing = false` when an EU/UK/CA visitor left the box unticked. The
  reward is still sent; the "tips and offers" line is left out, and phase-2
  sending must skip these rows.
- Bounced or complained addresses are never mailed again, even on re-signup.
- An unsubscribed address that signs up again is reactivated (new consent).
- Code emails state the expiry as an exact local time in the subscriber's time
  zone (fallback Pacific/Honolulu) and never mention later prices or cancelling.
- Brands can sit in different Resend accounts: `RESEND_API_KEY_<NAME>`
  (`RESEND_API_KEY_SOLVEDPARTY`, `RESEND_API_KEY_SUNDAY101`, …) overrides
  `RESEND_API_KEY` for that brand. Each account gets its own webhook to
  `/api/webhooks/resend`; `RESEND_WEBHOOK_SECRET` lists their secrets
  comma-separated.
- The token is random and stored on the row (no `EMAIL_TOKEN_SECRET` needed).

## Follow-ups and seasonal sends (phase 2)

A site can send `reward.product` with a signup: the product its emails should
sell (`src/lib/capture/product.ts`; Sunlight builds it in
`src/lib/email-capture/emailProduct.ts`). It is kept on the row as `context`.

- **Welcome email:** a "Want more like this?" card under the download (book,
  cover, paperback button, $4.99 PDF link). Left out when `marketing = false`.
- **Sequence** (`sequences.ts`, Sunlight only): day 2 a second free printable,
  day 5 the book (paperback or PDF), day 9 a real customer quote + the other
  age editions. The edition follows the one-tap age answer. Only active,
  `marketing = true` rows with a `context`; a step more than 72 h overdue is
  dropped; a book they already bought as a PDF (`sk_orders`) isn't pitched.
- **Campaigns** (`campaigns.ts`): one-off sends to the whole list, as of
  `sendAt`, until `until`. 2026: Black Friday (Nov 27, 7 AM HST) and the
  last-minute PDF send (Dec 21, 7 AM HST). Christmas product data is generated
  by sunlight's `scripts/email-campaign-data.ts` into `campaignData.ts`.
- **Once only:** every send is claimed in `capture_sends` (subscriber, key)
  before it goes and released if Resend fails, so overlapping runs never
  double-send. Throttled to ~2/s with a 4-minute budget per run; the rest goes
  next run.
- **Clicks:** measured by Resend click tracking on the sending domain, not UTMs.

Needs migration `0002_capture_followups` (`subscribers.context`,
`capture_sends`) applied **before** this code deploys: the signup insert
writes `context`.

## Code

- `src/lib/capture/core.ts` — validation, round robin, HST day, expiry format
- `src/lib/capture/service.ts` — route behavior with storage + email injected
- `src/lib/capture/store.ts` / `pgStore.ts` — in-memory (tests) / Postgres
- `src/lib/email/brands.ts` — sender, reply-to, color, origin, address per brand
- `src/lib/email/reward.ts` — code / download / list templates
- `src/lib/email/kit.ts`, `productBlocks.ts` — shared email shell and product card
- `src/lib/capture/followups.ts` — the follow-up cron (sequence + campaigns)
- `src/db/migrations/0001_email_capture.sql` — tables (RLS on, no policies); `supabase/0005` is the same SQL, kept as history

## Tests

`pnpm test` (node:test via tsx). In-memory store and a fake sender: no
database, no Resend, no Slack, fake addresses only.

## Before production

1. Once: `ENV_FILE=.env.production pnpm db:baseline` (dry run), then with
   `--apply`. Then `ENV_FILE=.env.production pnpm db:migrate` creates the three
   tables (`src/db/migrations/0001_email_capture.sql`).
2. Verify `mail.<domain>` in Resend for each brand (records in the hand-off note).
3. Set `CAPTURE_REPORT_SECRET`, `CAPTURE_PROXY_SECRET`, `RESEND_WEBHOOK_SECRET`
   (and optionally `SLACK_CAPTURE_CHANNEL`) in Vercel; add the Resend webhook
   in every Resend account that sends popup mail. Set
   `RESEND_API_KEY_SOLVEDPARTY` / `RESEND_API_KEY_SUNDAY101` to a key from
   their account.
4. Confirm reply-to mailboxes in `brands.ts` exist (`hello@<domain>`;
   RefundAuto uses `support@refundauto.com`).
