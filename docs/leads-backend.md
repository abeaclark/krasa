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
  [ any site's form ] --POST JSON--> https://www.krasadev.com/api/leads
                                          |
                                          |-- insert row  --> Supabase: public.leads
                                          |-- notify      --> Slack incoming webhook
                                          '-- 201 { ok, id }
```

- **One endpoint:** `POST /api/leads` (Node runtime). CORS-restricted to the
  five sites + localhost + `*.vercel.app` previews. Document uploads add
  `/api/leads/upload-url`, `/api/leads/upload`, and `/api/leads/documents` —
  see [Document uploads](#document-uploads).
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
   - `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — only needed for document
     uploads (see below). Project Settings → API. The service_role key is
     **server-only**; never prefix it with `NEXT_PUBLIC_`. Leave unset to
     disable uploads — the endpoints return 503 and everything else works.
3. **Create the table** — either:
   - `npm run db:push` (Drizzle diffs `src/db/schema.ts` against the DB), **or**
   - paste `supabase/0000_init_leads.sql` into the Supabase SQL editor and run.
4. **Create the documents bucket** (only if you want uploads): paste
   `supabase/0002_lead_documents.sql` into the Supabase SQL editor and run.
5. **Run it:** `npm run dev` → `POST http://localhost:3000/api/leads`.

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

## Document uploads

Customers can attach paperwork to a lead — RefundAuto's purchase-contract
upload is the first consumer. Files live in a **private** Supabase Storage
bucket (`lead-documents`); the lead row only carries pointers.

```
  [ browser ] --1. POST /api/leads/upload-url--> [ krasadev ] --sign--> Supabase
             <-------- { uploadUrl, document } --------
             --2. PUT the file straight to Supabase Storage -------->
             --3. descriptors ride along in the lead's meta.documents
```

**Why two steps.** Vercel Functions cap request bodies at **4.5MB**. A phone
photo of a retail installment contract routinely exceeds that and a scanned
multi-page PDF nearly always does, so routing bytes through our own API would
413 on exactly the files we most want. The signed URL keeps the bytes off
Vercel entirely.

**Object layout:** `{site}/{leadId | clientRef}/{timestamp}-{safe-name}`

The upload usually happens *before* the lead exists (RefundAuto asks for
documents four questions ahead of the contact step), so the client mints a
`clientRef` UUID at funnel start and files under that. Both `site` and the ref
are validated before becoming path segments — `site` must be in `SITES`, the
ref must be a UUID — so a hostile value can't escape its prefix.

### Endpoints

`POST /api/leads/upload-url` — mint a signed URL (**preferred**)

```jsonc
{ "site": "refundauto.com", "clientRef": "<uuid>",  // or "leadId"
  "fileName": "contract.pdf", "contentType": "application/pdf", "size": 8123456 }
// -> 200 { ok: true, uploadUrl, document: { path, name, size, contentType, uploadedAt } }
```

The token is scoped to one object path and expires in 2 hours. `size` and
`contentType` are the browser's claims, used for a fast friendly rejection; the
real enforcement is the bucket's `file_size_limit` (20MB) and
`allowed_mime_types`, applied by Supabase when the bytes land.

`POST /api/leads/upload` — multipart, **fallback only**. Streams the file
through this server, so it inherits Vercel's 4.5MB limit. Kept for small files.

`POST /api/leads/documents` — attach descriptors to a lead that already exists.
Only needed for a late upload; in the normal funnel the descriptors travel in
the lead's own `meta.documents` at creation. Descriptors come from the browser,
so paths are validated against the lead's / clientRef's own folder and
attaching is idempotent by path.

### Reading files back

The bucket has no public policies — every read goes through
`signLeadDocument(path)` in `src/lib/storage.ts`, which mints a short-lived
signed URL server-side. Don't add an RLS policy to make it browsable.

## Per-site integration

Each consumer site has a copy of `src/lib/leads.ts` exporting `submitLead()`,
pre-set to its own `site` and pointed at `https://www.krasadev.com/api/leads`
(override with `NEXT_PUBLIC_LEADS_ENDPOINT`). Wired forms:

- **krasadev.com** — `Contact` section (`src/components/Contact.tsx`)
- **localservicegroup.com** — `QuoteForm` (`src/components/QuoteForm.tsx`)
- **krasa.ai** — consultation page (`src/app/consultation/page.tsx`)
- **refundauto.com** — funnel contact step (`src/components/form/StepPage.tsx`), full funnel context sent as `meta`; also uploads purchase paperwork via the signed-URL flow above
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
