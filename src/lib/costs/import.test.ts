import { describe, expect, it } from "vitest";

import { CostImportInputError, parseCostImportRecords } from "./import";

const campaignId = "123e4567-e89b-12d3-a456-426614174000";

function expectInputError(run: () => unknown, field: string): void {
  expect(run).toThrowError(CostImportInputError);
  try {
    run();
  } catch (caught) {
    expect(caught).toMatchObject({ field });
  }
}

describe("cost import validation", () => {
  it("parses a daily campaign cost with normalized currency", () => {
    expect(parseCostImportRecords([
      { campaignId, date: "2026-10-03", currency: "idr", costMinor: 250_000 },
    ])).toEqual([
      { campaignId, date: "2026-10-03", currency: "IDR", costMinor: 250_000 },
    ]);
  });

  it("accepts zero cost while keeping it different from an absent record", () => {
    expect(parseCostImportRecords([
      { campaignId, date: "2026-10-03", currency: "IDR", costMinor: 0 },
    ])[0]?.costMinor).toBe(0);
    expect(parseCostImportRecords([])).toEqual([]);
  });

  it("rejects invalid campaign, date, currency, and value fields", () => {
    expectInputError(() => parseCostImportRecords([
      { campaignId: "not-a-uuid", date: "2026-10-03", currency: "IDR", costMinor: 1 },
    ]), "campaignId");
    expectInputError(() => parseCostImportRecords([
      { campaignId, date: "2026-02-30", currency: "IDR", costMinor: 1 },
    ]), "date");
    expectInputError(() => parseCostImportRecords([
      { campaignId, date: "2026-10-03", currency: "US", costMinor: 1 },
    ]), "currency");
    expectInputError(() => parseCostImportRecords([
      { campaignId, date: "2026-10-03", currency: "IDR", costMinor: 1.5 },
    ]), "costMinor");
  });

  it("rejects duplicate campaign-day-currency records in one batch", () => {
    expectInputError(() => parseCostImportRecords([
      { campaignId, date: "2026-10-03", currency: "IDR", costMinor: 1 },
      { campaignId, date: "2026-10-03", currency: "idr", costMinor: 2 },
    ]), "records");
  });
});
