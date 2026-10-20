import { describe, expect, it } from "vitest";

import { parseDateInTimezone } from "./timezone";

describe("parseDateInTimezone", () => {
  it("converts a selected Jakarta day into a half-open UTC range", () => {
    const from = parseDateInTimezone("2026-10-19", "Asia/Jakarta");
    const to = parseDateInTimezone("2026-10-19", "Asia/Jakarta", true);

    expect(from?.toISOString()).toBe("2026-10-18T17:00:00.000Z");
    expect(to?.toISOString()).toBe("2026-10-19T17:00:00.000Z");
  });

  it("rejects malformed dates", () => {
    expect(parseDateInTimezone("19/10/2026", "Asia/Jakarta")).toBeUndefined();
    expect(parseDateInTimezone("2026-02-30", "Asia/Jakarta")).toBeUndefined();
  });
});
