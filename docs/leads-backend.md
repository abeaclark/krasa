# Global Leads Backend

A single, shared lead-storage + notification service for all of Abe's sites.
Lives in the **krasadev** repo (Next.js, deployed at **krasadev.com**), backed by
**Supabase Postgres** via **Drizzle ORM** (same setup as `wonderful-app`), with
**Slack** notifications on every new lead. Replaces the old per-site Google
Sheets / Google Forms flow.

Sites served: `krasadev.com`, `krasa.ai`, `localservicegroup.com`,
`refundauto.com`, `sunlightkids.com`.

## How it fits together

```
  [ any site's form ] --POST JSON--> https://krasadev.com/api/leads
                                          |
                                          |-- insert row  --> Supabase: public.leads
                                          |-- notify      --> Slack incoming webhook
                                          '-- 201 { ok, id }
```

- **One endpoint:** `POST /api/leads` (Node runtime). CORS-restricted to the
  five sites + localhost + `*.vercel.app` previews.
- **One table:** `leads`. Core CRM columns are shared; anything site-specific
  goes in a `meta` JSONB blob, so a new per-site field never needs a migration.
- **Status is a code enum** (`src/lib/enums.ts`), not a Postgres enum — change
  the pipeline without touching the DB.

## Data model (`src/db/schema.ts`)

| column       | type          | notes                                            |
|--------------|---------------|--------------------------------------------------|
| `id`         | uuid (pk)     | `gen_random_uuid()`                              |
| `site`       | varchar       | attribution, e.g. `krasadev.com` (required)      |
| `source`     | varchar       | form/page, e.g. `contact`, `quote`, `consultation`, `refund-funnel` |
| `status`     | varchar       | code enum: `new` → `contacted` → `qualified` → `won` / `lost` / `spam` (default `new`) |
| `name`       | varchar       |                                                  |
| `email`      | varchar       |                                                  |
| `phone`      | varchar       |                                                  |
| `message`    | text          |                                                  |
| `meta`       | jsonb         | per-site extras (service, city, vehicle details, UTM, …) |
| `created_at` | timestamptz   | **received date**, default `now()`               |
| `updated_at` | timestamptz   | bumped on status changes                         |

Indexed on `site`, `status`, `created_at`, `email`.

## First-time setup

1. **Install deps** (the repo is now Next.js, not Vite):
   ```bash
   cd krasa && npm install
   ```
2. **Create `.env`** from `.env.example` and fill in:
   - `DATABASE_URL` — Supabase project `hrzvqnjikgqcmnhucfbf`, "Transaction
     pooler" URI (port 6543), with your DB password.
   - `SLACK_WEBHOOK_URL` — incoming webhook for the channel that should get
     lead pings (https://api.slack.com/messaging/webhooks). Optional locally.
3. **Create the table** — either:
   - `npm run db:push` (Drizzle diffs `src/db/schema.ts` against the DB), **or**
   - paste `supabase/0000_init_leads.sql` into the Supabase SQL editor and run.
4. **Run it:** `npm run dev` → `POST http://localhost:3000/api/leads`.

Drizzle scripts (mirroring `wonderful-app`): `db:generate`, `db:push`,
`db:migrate`, `db:studio`, `db:pull`.

## Endpoint contract

`POST /api/leads` — `Content-Type: application/json`

```jsonc
{
  "site":    "krasadev.com",   // required
  "source":  "contact",         // optional
  "name":    "Jane Smith",      // optional
  "email":   "jane@acme.com",   // email or phone or name required
  "phone":   "+1 555 123 4567", // optional
  "message": "…",               // optional
  "meta":    { "service": "HVAC", "city": "Phoenix" }, // optional, free-form
  "hp":      ""                  // honeypot — leave empty; bots get silently dropped
}
```

Responses: `201 { ok: true, id }` · `400 { ok: false, error }` ·
`500 { ok: false, error }`. Status always defaults to `new`.

## Per-site integration

Each consumer site has a copy of `src/lib/leads.ts` exporting `submitLead()`,
pre-set to its own `site` and pointed at `https://krasadev.com/api/leads`
(override with `NEXT_PUBLIC_LEADS_ENDPOINT`). Wired forms:

- **krasadev.com** — `Contact` section (`src/components/Contact.tsx`)
- **localservicegroup.com** — `QuoteForm` (`src/components/QuoteForm.tsx`)
- **krasa.ai** — consultation page (`src/app/consultation/page.tsx`)
- **refundauto.com** — funnel contact step (`src/components/form/StepPage.tsx`), full funnel context sent as `meta`
- **sunlightkids.com** — new `ContactForm` on `/contact`

To add another form: `import { submitLead } from "@/lib/leads"` and call it with
`{ source, name, email, phone, message, meta }`.

## Actioning leads

`status` starts at `new`. Update it as you work a lead, e.g.:

```sql
update leads set status = 'contacted' where id = '…';
```

Allowed values live in `src/lib/enums.ts` (`LEAD_STATUSES`). Add/rename freely —
no migration needed since it's a plain varchar.

## Notes

- Slack failures never fail lead capture (the row is already stored).
- The honeypot (`hp`) silently drops obvious bots; flip the handler in
  `src/app/api/leads/route.ts` if you'd rather store them as `status: "spam"`.
