export type DashboardMetricInput = {
  clicks: number;
  conversions: number;
  revenueMinor: number;
  costMinor?: number | null;
};

export type DashboardMetrics = {
  clicks: number;
  conversions: number;
  revenueMinor: number;
  costMinor: number | null;
  conversionRate: number | null;
  profitMinor: number | null;
  roi: number | null;
};

function requireFiniteNonNegative(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a finite, non-negative number.`);
  }
  return value;
}

/**
 * Calculate dashboard metrics from persisted aggregate facts.
 * Rates are unavailable (null) when their denominator is absent or zero.
 */
export function calculateDashboardMetrics(input: DashboardMetricInput): DashboardMetrics {
  const clicks = requireFiniteNonNegative(input.clicks, "clicks");
  const conversions = requireFiniteNonNegative(input.conversions, "conversions");
  const revenueMinor = requireFiniteNonNegative(input.revenueMinor, "revenueMinor");
  const costMinor = input.costMinor == null
    ? null
    : requireFiniteNonNegative(input.costMinor, "costMinor");

  const conversionRate = clicks === 0 ? null : conversions / clicks;
  const profitMinor = costMinor === null ? null : revenueMinor - costMinor;
  const roi = costMinor === null || costMinor === 0 ? null : (profitMinor ?? 0) / costMinor;

  return {
    clicks,
    conversions,
    revenueMinor,
    costMinor,
    conversionRate,
    profitMinor,
    roi,
  };
}

