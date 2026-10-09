import { describe, expect, it } from "vitest";
import { forecastMarket, rankProperties, walkForwardBacktest } from "./prediction-engine";

const observations = Array.from({ length: 24 }, (_, i) => ({
  date: `2025-${String((i % 12) + 1).padStart(2, "0")}-01`,
  priceM2: 100_000 * Math.pow(1.005, i),
  rentM2: 300,
  listings: 500,
  mortgageRateBps: 500 - Math.min(i * 8, 150),
  wageGrowthBps: 500,
  populationGrowthBps: 100,
  creditGrowthBps: 600,
}));

describe("prediction engine", () => {
  it("returns a probabilistic market distribution", () => {
    const f = forecastMarket(observations, 12, { simulations: 1500, seed: 42 });
    expect(f.priceDistribution.p10).toBeLessThanOrEqual(f.priceDistribution.p50);
    expect(f.priceDistribution.p50).toBeLessThanOrEqual(f.priceDistribution.p90);
    expect(f.confidence).toBeGreaterThan(0);
    expect(f.regimeProbabilities.NORMAL + f.regimeProbabilities.GROWTH + f.regimeProbabilities.BOOM).toBeLessThanOrEqual(1);
  });

  it("ranks properties without mutating the inputs", () => {
    const f = forecastMarket(observations, 12, { simulations: 1200, seed: 7 });
    const r = rankProperties([
      { id: "cheap", price: 2_000_000, areaM2: 25, estimatedValue: 2_500_000, estimatedRent: 13_000, availabilityConfirmed: true },
      { id: "expensive", price: 3_500_000, areaM2: 25, estimatedValue: 3_000_000, estimatedRent: 10_000 },
    ], f, { simulations: 1200, seed: 7 });
    expect(r[0]?.propertyId).toBe("cheap");
    expect(r[0]?.investmentScore).toBeGreaterThan(r[1]?.investmentScore ?? 0);
  });

  it("supports walk-forward validation", () => {
    const r = walkForwardBacktest(observations, 1);
    expect(r.points.length).toBeGreaterThan(0);
    expect(Number.isFinite(r.mape)).toBe(true);
  });
});
