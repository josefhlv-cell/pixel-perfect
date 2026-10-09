import { describe, expect, it } from "vitest";
import { buildPropertyFutureTwin } from "./property-future-twin";
import { findDecisionBoundary, runPropertyShockMatrix } from "./property-shock-matrix";

describe("Property Future Twin", () => {
  const input = {
    purchasePrice: 5_000_000,
    fairValue: 5_800_000,
    fairValueP10: 5_400_000,
    fairValueP90: 6_100_000,
    valuationConfidence: 0.85,
    monthlyRent: 25_000,
    monthlyCosts: 5_000,
    financingRate: 4,
    loanAmount: 3_500_000,
    horizonMonths: 60,
    marketGrowthP50: 0.04,
    marketGrowthP10: -0.03,
    marketGrowthP90: 0.08,
    liquidityScore: 0.8,
  };

  it("produces scenario-specific property outcomes", () => {
    const twin = buildPropertyFutureTwin(input);
    expect(twin.scenarios).toHaveLength(3);
    expect(twin.maxSafePrice).toBeGreaterThan(0);
  });

  it("finds a decision boundary under shocks", () => {
    const outcomes = runPropertyShockMatrix(input, [
      [],
      [{ key: "RATE", delta: 3 }],
      [{ key: "LIQUIDITY", delta: -0.5 }, { key: "SUPPLY", delta: 0.08 }],
    ]);
    const boundary = findDecisionBoundary(outcomes);
    expect(boundary.safeCount + boundary.unsafeCount).toBe(3);
  });
});
