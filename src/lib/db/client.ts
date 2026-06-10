import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

export const runtime = "nodejs"; // ensure Node runtime for any route importing this

const connectionString = process.env.DATABASE_URL!;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// Singleton guard (prevents multiple clients in hot reload / serverless).
let client: ReturnType<typeof postgres> | undefined;

function getClient() {
  if (!client) {
    client = postgres(connectionString, {
      // PgBouncer / Supabase pooler friendly — same settings as wonderful-app.
      prepare: false, // IMPORTANT with the transaction pooler
      ssl: process.env.NODE_ENV === "production" ? "require" : false,
      max: 3, // low per-instance; the pooler handles cross-instance pooling
      idle_timeout: 20, // seconds
      connect_timeout: 10, // seconds
    });
  }
  return client;
}

const pg = getClient();

export const db = drizzle(pg, { schema });

export { pg as client };
