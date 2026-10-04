import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const TEST_SLUG = "demo.test";
const TEST_DESTINATION = "https://example.test/checkout";

if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to seed a test campaign when NODE_ENV=production.");
}

if (process.env.TRACK_IN_ALLOW_TEST_SEED !== "1") {
  throw new Error(
    "Test seed is disabled. Set TRACK_IN_ALLOW_TEST_SEED=1 for this one command."
  );
}

const connectionString = process.env.DIRECT_URL;
if (!connectionString) {
  throw new Error("DIRECT_URL is required to seed the test campaign.");
}

const databaseUrl = new URL(connectionString);
if (!databaseUrl.pathname || databaseUrl.pathname === "/") {
  throw new Error("DIRECT_URL must include an explicit database name.");
}

const sql = neon(connectionString);
const existing = await sql`
  SELECT id
  FROM campaigns
  WHERE lower(slug) = lower(${TEST_SLUG})
  LIMIT 1
`;

if (existing.length > 0) {
  await sql`
    UPDATE campaigns
    SET name = ${"Demo test campaign"},
        status = 'active'::campaign_status,
        destination_url = ${TEST_DESTINATION},
        traffic_source_id = NULL,
        default_currency = 'IDR',
        allowed_tracking_parameters = ${JSON.stringify(["gclid", "fbclid", "campaign_id"])}::jsonb,
        archived_at = NULL,
        updated_at = now()
    WHERE id = ${existing[0].id}
  `;
} else {
  await sql`
    INSERT INTO campaigns (
      slug,
      name,
      status,
      destination_url,
      default_currency,
      allowed_tracking_parameters
    ) VALUES (
      ${TEST_SLUG},
      ${"Demo test campaign"},
      'active'::campaign_status,
      ${TEST_DESTINATION},
      'IDR',
      ${JSON.stringify(["gclid", "fbclid", "campaign_id"])}::jsonb
    )
  `;
}

console.log(`Active test campaign ready: ${TEST_SLUG}`);
