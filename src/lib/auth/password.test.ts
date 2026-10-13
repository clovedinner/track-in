import { describe, expect, it } from "vitest";

import { hashPassword, normalizeEmail, validatePassword, verifyPassword } from "./password";

describe("password authentication helpers", () => {
  it("normalizes valid email addresses", () => {
    expect(normalizeEmail("  Operator@Example.COM ")).toBe("operator@example.com");
    expect(normalizeEmail("not-an-email")).toBeUndefined();
  });

  it("requires a strong enough password", () => {
    expect(validatePassword("short")).toMatch(/12 and 128 characters/);
    expect(validatePassword("a".repeat(12))).toBeUndefined();
    expect(validatePassword("a".repeat(129))).toMatch(/128 characters/);
  });

  it("hashes and verifies without storing the plaintext", async () => {
    const password = "correct horse battery staple";
    const hash = await hashPassword(password);
    expect(hash).toMatch(/^scrypt\$/);
    expect(hash).not.toContain(password);
    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  });
});
