import { existsSync } from "node:fs";

import { config } from "dotenv";
import { defineConfig } from "prisma/config";

const environmentFile = process.env.NODE_ENV === "production" || !existsSync(".env.local")
  ? ".env.production"
  : ".env.local";

config({ path: environmentFile });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // `DIRECT_URL` is needed for migrations; generation can run without secrets.
    url: process.env.DIRECT_URL ?? "postgresql://localhost:5432/trackin",
  },
});
