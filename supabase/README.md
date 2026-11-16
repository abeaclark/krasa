# supabase/ — history only

These hand-written SQL files built Krasa's database before the repo used
drizzle migrations (0000–0005, run in the Supabase SQL editor). Don't add new
files here.

Schema changes now go through drizzle:

1. Edit `src/db/schema.ts`.
2. `pnpm db:generate --name <what_changed>` writes `src/db/migrations/NNNN_*.sql`.
3. `pnpm db:migrate` applies it (`ENV_FILE=.env.production` for production).

`src/db/migrations/0000_baseline.sql` describes what 0000–0004 built. It is never
run: `pnpm db:baseline --apply` marked it as applied once, on Nov 16, 2026.

Not managed by drizzle (left exactly as these files made them): the
`lead-documents` storage bucket (0002), the `set_updated_at()` triggers,
`sk_claim_download()` and the grants (0003). Changes to those still need SQL —
put it in a drizzle custom migration (`pnpm db:generate --custom`).

Don't use `pnpm db:push` against production; use generate + migrate.
