import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";

// Mirrors the wonderful-app setup: load env (supports ENV_FILE to switch
// between .env and .env.production), point drizzle-kit at the schema, and
// emit migrations into src/db/migrations.
const envFile = process.env.ENV_FILE || ".env";
dotenv.config({ path: envFile });

export default {
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },
} satisfies Config;
