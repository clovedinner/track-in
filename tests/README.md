# Test suites

- `src/**/*.test.ts`: fast unit tests with Vitest. They must not connect to PostgreSQL or external providers.
- `tests/integration`: PostgreSQL integration tests. They require `TEST_DATABASE_URL`, reject a value equal to `DATABASE_URL`, and use a disposable database only.
- `tests/e2e`: Playwright scenarios. They must use test-only configuration and intercept outbound provider requests.

Run `npm run test:unit` now. Integration and end-to-end suites are intentionally not runnable until a disposable PostgreSQL runtime and the required test fixtures exist.
