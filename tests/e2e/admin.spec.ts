import { test, expect } from "@playwright/test";

const baseUrl = process.env.E2E_BASE_URL;
const adminUsername = process.env.E2E_ADMIN_USERNAME;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

test.describe("private admin routes", () => {
  test.skip(!baseUrl, "Set E2E_BASE_URL to run browser checks against a running app.");

  test("rejects an unauthenticated admin request", async ({ request }) => {
    const response = await request.get("/admin");
    expect(response.status()).toBe(401);
    expect(response.headers()["www-authenticate"]).toContain("Basic");
  });
});

test.describe("authenticated admin dashboard", () => {
  test.skip(
    !baseUrl || !adminUsername || !adminPassword,
    "Set E2E_BASE_URL, E2E_ADMIN_USERNAME, and E2E_ADMIN_PASSWORD to run authenticated browser checks.",
  );
  test.use({
    httpCredentials: {
      username: adminUsername ?? "",
      password: adminPassword ?? "",
    },
  });

  test("renders database-backed overview metrics", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await expect(page.getByRole("heading", { name: "Performance overview." })).toBeVisible();
    await expect(page.getByRole("region", { name: "Overview metrics" })).toContainText("Clicks");
    await expect(page.getByText("Live database metrics")).toBeVisible();
  });

  test("navigates from campaign list to campaign detail", async ({ page }) => {
    await page.goto("/admin/campaigns");
    const campaignLink = page.locator('a[href^="/admin/campaigns/"]').first();
    await expect(campaignLink).toBeVisible();
    const campaignName = (await campaignLink.textContent())?.trim();
    await campaignLink.click();
    await expect(page).toHaveURL(/\/admin\/campaigns\/[^/]+$/);
    if (campaignName) await expect(page.getByRole("heading", { name: campaignName })).toBeVisible();
  });

  test("calls the retry API from delivery health", async ({ page }) => {
    const postbackId = "00000000-0000-4000-8000-000000000001";
    let retryCalled = false;
    await page.route("**/api/admin/delivery-health", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "all",
          counts: { pending: 0, processing: 0, retryable_failed: 1, delivered: 0, permanently_failed: 0 },
          postbacks: [{
            id: postbackId,
            destination_host: "example.test",
            status: "retryable_failed",
            attempt_count: 1,
            next_attempt_at: null,
            last_response_status: 502,
            last_response_summary: "upstream unavailable",
            last_error: null,
            delivered_at: null,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
            conversion: { event_id: "evt-e2e", event_type: "ftd", value_minor: "100", currency: "IDR", click_id: "click-e2e", campaign: { slug: "demo.test", name: "Demo" } },
            traffic_source: { id: "00000000-0000-4000-8000-000000000002", name: "TrafficStars", type: "trafficstars" },
          }],
        }),
      });
    });
    await page.route(`**/api/admin/delivery-health/${postbackId}/retry`, async (route) => {
      retryCalled = true;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "queued", postback_id: postbackId }) });
    });

    await page.goto("/admin/delivery-health");
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByText("Delivery queued for retry.")).toBeVisible();
    expect(retryCalled).toBe(true);
  });
});
