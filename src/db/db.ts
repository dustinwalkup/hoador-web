import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { schema } from "./schemas";

const DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://mock:mock@localhost:5432/mock";

const sql = neon(DATABASE_URL);
export const db = drizzle(sql, { schema, logger: true });
