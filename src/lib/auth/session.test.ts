import { describe, expect, it, vi } from "vitest";

import { createSessionToken, verifySessionToken } from "./session";

describe("dashboard sessions", () => {
  it("signs and verifies a session token", async () => {
    vi.stubEnv("AUTH_SESSION_SECRET", "a-session-secret-that-is-at-least-32-chars");
    const token = await createSessionToken({ id: "user-1", email: "operator@example.com" });
    await expect(verifySessionToken(token)).resolves.toMatchObject({
      userId: "user-1",
      email: "operator@example.com",
    });
    vi.unstubAllEnvs();
  });

  it("rejects a tampered token", async () => {
    vi.stubEnv("AUTH_SESSION_SECRET", "a-session-secret-that-is-at-least-32-chars");
    const token = await createSessionToken({ id: "user-1", email: "operator@example.com" });
    await expect(verifySessionToken(`${token}tampered`)).resolves.toBeNull();
    vi.unstubAllEnvs();
  });
});
