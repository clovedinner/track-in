import { existsSync } from "node:fs";

import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

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
    url: env("DIRECT_URL"),
  },
});
