import { describe, expect, it } from "vitest";
import { projectPropertyTrajectory } from "./property-trajectory";
import { analyzePropertyPathRisk } from "./property-path-risk";
import { explainDecisionSensitivity } from "./decision-sensitivity";

describe("Property Future Twin trajectory", () => {
  it("tracks value, rent, equity and liquidity through time", () => {
    const points = projectPropertyTrajectory({
      purchasePrice: 5_000_000,
      initialRent: 25_000,
      monthlyCosts: 5_000,
      loanAmount: 3_500_000,
      months: 12,
      monthlyPriceGrowth: 0.002,
      monthlyRentGrowth: 0.001,
      monthlyLiquidityChange: -0.01,
    });
    expect(points).toHaveLength(12);
    expect(points.at(-1)!.propertyValue).toBeGreaterThan(5_000_000);
    expect(points.at(-1)!.liquidityScore).toBeLessThan(1);
  });

  it("captures path risk separately from terminal return", () => {
    const points = projectPropertyTrajectory({
      purchasePrice: 5_000_000,
      initialRent: 25_000,
      monthlyCosts: 5_000,
      loanAmount: 3_500_000,
      months: 12,
      monthlyPriceGrowth: -0.01,
      monthlyRentGrowth: 0,
      monthlyLiquidityChange: -0.03,
    });
    const risk = analyzePropertyPathRisk(points);
    expect(risk.maxDrawdown).toBeGreaterThan(0.1);
    expect(risk.pathRisk).toBeGreaterThan(0.1);
  });

  it("can expose decision sensitivity", async () => {
    const { buildPropertyFutureTwin } = await import("./property-future-twin");
    const input = {
      purchasePrice: 5_000_000, fairValue: 6_000_000, fairValueP10: 5_700_000, fairValueP90: 6_200_000,
      valuationConfidence: 0.9, monthlyRent: 25_000, monthlyCosts: 5_000, financingRate: 4,
      loanAmount: 3_500_000, horizonMonths: 60, marketGrowthP50: 0.04, marketGrowthP10: -0.02,
      marketGrowthP90: 0.08, liquidityScore: 0.8,
    };
    const sensitivity = explainDecisionSensitivity(input, { financingRate: 7, liquidityScore: 0.2 });
    expect(sensitivity.length).toBe(2);
    expect(sensitivity.some((x) => x.changedDecision)).toBe(true);
  });
});
