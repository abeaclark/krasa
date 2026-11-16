// One-time: tell drizzle that 0000_baseline is already in the database.
//
// Krasa's tables were made by hand-written SQL (supabase/0000–0004) before the
// repo used drizzle migrations. This records src/db/migrations/0000_baseline
// in drizzle.__drizzle_migrations — exactly the row `drizzle-kit migrate` would
// have written — WITHOUT running it, so `pnpm db:migrate` applies only what
// comes after.
//
// If supabase/0005_email_capture.sql was already run by hand, the three
// email-capture tables exist too, and 0001_email_capture is recorded as well.
//
//   pnpm db:baseline                       dry run against .env
//   ENV_FILE=.env.production pnpm db:baseline --apply
//
// Refuses when the tables it vouches for are missing, or when drizzle already
// has migrations recorded (nothing to do).
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import postgres from "postgres";

const apply = process.argv.includes("--apply");
const envFile = process.env.ENV_FILE || ".env";
dotenv.config({ path: envFile });
const url = process.env.DATABASE_URL;
if (!url) {
  console.error(`DATABASE_URL is not set (read ${envFile}).`);
  process.exit(1);
}

const dir = path.resolve("src/db/migrations");
const journal = JSON.parse(fs.readFileSync(path.join(dir, "meta/_journal.json"), "utf8"));
const entry = (tag) => {
  const e = journal.entries.find((x) => x.tag === tag);
  if (!e) throw new Error(`${tag} is not in the journal`);
  const sql = fs.readFileSync(path.join(dir, `${tag}.sql`)).toString();
  // Same hash drizzle-orm's migrator computes (sha256 of the whole file).
  return { tag, when: e.when, hash: crypto.createHash("sha256").update(sql).digest("hex") };
};

const BASELINE_TABLES = ["leads", "heartbeats", "sk_orders", "sk_download_events"];
const CAPTURE_TABLES = ["subscribers", "capture_stats_daily", "capture_assign"];

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  const host = new URL(url).host;
  const rows = await sql`select table_name from information_schema.tables where table_schema = 'public'`;
  const have = new Set(rows.map((r) => r.table_name));
  console.log(`Database: ${host} (${envFile})`);

  const missing = BASELINE_TABLES.filter((t) => !have.has(t));
  if (missing.length) {
    console.error(`Refusing: the baseline says these exist, but they don't: ${missing.join(", ")}.`);
    console.error("Wrong database? On an empty database, run `pnpm db:migrate` instead.");
    process.exit(1);
  }

  const record = [entry("0000_baseline")];
  const capture = CAPTURE_TABLES.filter((t) => have.has(t));
  if (capture.length === CAPTURE_TABLES.length) {
    record.push(entry("0001_email_capture"));
    console.log("Email-capture tables already exist (0005 was run by hand): recording 0001 too.");
  } else if (capture.length) {
    console.error(`Refusing: only some email-capture tables exist (${capture.join(", ")}). Fix by hand first.`);
    process.exit(1);
  }

  const [{ exists }] = await sql`select to_regclass('drizzle.__drizzle_migrations') is not null as exists`;
  if (exists) {
    const done = await sql`select hash, created_at from drizzle.__drizzle_migrations order by created_at`;
    if (done.length) {
      console.log(`Nothing to do: drizzle already has ${done.length} migration(s) recorded.`);
      process.exit(0);
    }
  }

  for (const r of record) console.log(`${apply ? "Recording" : "Would record"} ${r.tag} (created_at ${r.when})`);
  if (!apply) {
    console.log("Dry run. Re-run with --apply to write.");
    process.exit(0);
  }

  await sql.begin(async (tx) => {
    await tx`create schema if not exists drizzle`;
    await tx`create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint)`;
    for (const r of record) {
      await tx`insert into drizzle.__drizzle_migrations (hash, created_at) values (${r.hash}, ${r.when})`;
    }
  });
  console.log("Done. `pnpm db:migrate` now applies only newer migrations.");
} finally {
  await sql.end();
}
