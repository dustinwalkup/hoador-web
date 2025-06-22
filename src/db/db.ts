import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { schema } from "./schemas";
import path from "path";

config({ path: ".env.local" });

console.log("Current working directory:", process.cwd());
console.log("Looking for .env.local at:", path.resolve(".env.local"));

const result = config({ path: ".env.local" });
console.log("Dotenv result:", result);
console.log(
  "All env vars:",
  Object.keys(process.env).filter((key) => key.includes("DATABASE")),
);

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema, logger: true });
