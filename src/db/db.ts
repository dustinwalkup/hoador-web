import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { schema } from "./schemas";
import { recordQuery } from "./query-tracker";

// WebSocket support for Node.js (needed for neon-serverless driver)
neonConfig.webSocketConstructor = ws;

const isE2E = process.env.E2E_TEST === "1";

// Dev-only query tracker hook. In production this is `false` so Drizzle
// skips the logger path entirely — zero overhead.
const queryLogger =
  process.env.NODE_ENV !== "production"
    ? {
        logQuery(query: string): void {
          recordQuery(query);
        },
      }
    : false;

const db = isE2E
  ? (await import("./db-e2e")).db
  : drizzle(
      new Pool({
        connectionString:
          process.env.DATABASE_URL ||
          "postgresql://mock:mock@localhost:5432/mock",
      }),
      { schema, logger: queryLogger },
    );

export { db };
