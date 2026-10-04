import { describe, expect, it } from "vitest";
import { calculateDashboardMetrics } from "./formulas";

describe("calculateDashboardMetrics", () => {
  it("calculates conversion rate, profit, and ROI", () => {
    expect(calculateDashboardMetrics({
      clicks: 200,
      conversions: 10,
      revenueMinor: 1_500_000,
      costMinor: 1_000_000,
    })).toEqual({
      clicks: 200,
      conversions: 10,
      revenueMinor: 1_500_000,
      costMinor: 1_000_000,
      conversionRate: 0.05,
      profitMinor: 500_000,
      roi: 0.5,
    });
  });

  it("leaves cost-dependent metrics unavailable when cost is missing", () => {
    expect(calculateDashboardMetrics({
      clicks: 10,
      conversions: 1,
      revenueMinor: 500,
    })).toMatchObject({
      conversionRate: 0.1,
      costMinor: null,
      profitMinor: null,
      roi: null,
    });
  });

  it("leaves conversion rate and ROI unavailable for zero denominators", () => {
    expect(calculateDashboardMetrics({
      clicks: 0,
      conversions: 0,
      revenueMinor: 100,
      costMinor: 0,
    })).toMatchObject({
      conversionRate: null,
      profitMinor: 100,
      roi: null,
    });
  });

  it("rejects invalid negative or non-finite facts", () => {
    expect(() => calculateDashboardMetrics({
      clicks: -1,
      conversions: 0,
      revenueMinor: 0,
    })).toThrow("clicks");
    expect(() => calculateDashboardMetrics({
      clicks: 1,
      conversions: Number.NaN,
      revenueMinor: 0,
    })).toThrow("conversions");
  });
});

