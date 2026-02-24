// Load environment variables FIRST
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { schema } from "./schemas";

// This database connection is specifically for Node.js scripts like seeds
// It uses the standard PostgreSQL driver which is the most reliable for Node.js
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  // Neon requires SSL
  ssl: {
    rejectUnauthorized: false,
  },
});

export const db = drizzle(pool, { schema, logger: false });
