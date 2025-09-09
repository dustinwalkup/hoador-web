import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { schema } from "./schemas";

config({ path: ".env.local" });

const DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://mock:mock@localhost:5432/mock";

const sql = neon(DATABASE_URL);
export const db = drizzle(sql, { schema, logger: true });
