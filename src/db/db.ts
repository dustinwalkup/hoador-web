import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { schema } from "./schemas";

const isE2E = process.env.E2E_TEST === "1";

const db = isE2E
  ? (await import("./db-e2e")).db
  : drizzle(
      neon(
        process.env.DATABASE_URL ||
          "postgresql://mock:mock@localhost:5432/mock",
      ),
      { schema, logger: false },
    );

export { db };
