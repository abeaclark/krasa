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
- The token is random and stored on the row (no `EMAIL_TOKEN_SECRET` needed).

## Code

- `src/lib/capture/core.ts` — validation, round robin, HST day, expiry format
- `src/lib/capture/service.ts` — route behavior with storage + email injected
- `src/lib/capture/store.ts` / `pgStore.ts` — in-memory (tests) / Postgres
- `src/lib/email/brands.ts` — sender, reply-to, color, origin, address per brand
- `src/lib/email/reward.ts` — code / download / list templates
- `supabase/0005_email_capture.sql` — tables (RLS on, no policies)

## Tests

`pnpm test` (node:test via tsx). In-memory store and a fake sender: no
database, no Resend, no Slack, fake addresses only.

## Before production

1. Run `supabase/0005_email_capture.sql` in the Supabase SQL editor.
2. Verify `mail.<domain>` in Resend for each brand (records in the hand-off note).
3. Set `CAPTURE_REPORT_SECRET`, `CAPTURE_PROXY_SECRET`, `RESEND_WEBHOOK_SECRET`
   (and optionally `SLACK_CAPTURE_CHANNEL`) in Vercel; add the Resend webhook.
4. Confirm reply-to mailboxes in `brands.ts` exist (`hello@<domain>`;
   RefundAuto uses `support@refundauto.com`).
