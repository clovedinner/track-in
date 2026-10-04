const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const applicationDatabaseUrl = process.env.DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL is required for integration tests. The suite will not use DATABASE_URL.",
  );
}

if (testDatabaseUrl === applicationDatabaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL must be different from DATABASE_URL to protect the application database.",
  );
}

const parsedUrl = new URL(testDatabaseUrl);

if (!parsedUrl.protocol.startsWith("postgres")) {
  throw new Error("TEST_DATABASE_URL must use a PostgreSQL connection string.");
}
