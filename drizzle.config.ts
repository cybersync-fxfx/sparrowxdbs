import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/deploy-schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ||
      `postgresql://${process.env.POSTGRES_USER || "sparrowx"}:${process.env.POSTGRES_PASSWORD || "sparrowx_ovh_secret_2026"}@${process.env.POSTGRES_HOST || "127.0.0.1"}:${process.env.POSTGRES_PORT || "5432"}/${process.env.POSTGRES_DB || "sparrowx_db"}`,
  },
});
