import "dotenv/config";
import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

console.log("DATABASE_URL", process.env.DATABASE_URL);

dotenv.config({ path: ".env.local" });

export default defineConfig({
  out: "./src/db/migrations",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
