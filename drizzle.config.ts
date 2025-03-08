import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" }); // Load .env.local

export default defineConfig({
  schema: "./src/app/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql", // Use "dialect" instead of "driver" in newer versions  dbCredentials: {
  dbCredentials: {
    url: process.env.DATABASE_URL!, // Use the full connection string
  },
})