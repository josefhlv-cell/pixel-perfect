import { describe, expect, it } from "vitest";
import { addDays } from "./levels";
import { runHousePriceForecast } from "./engine";
import type { LevelObservation } from "./levels";

function observedLevels(values: readonly number[], start = "2010-01-01T00:00:00.000Z"): LevelObservation[] {
  return values.map((level, index) => {
    const period = addDays(start, index * 91);
    return { period, level, vintageDate: addDays(period, 1), quality: "OBSERVED_VINTAGE" as const };
  });
}

describe("house price forecast engine", () => {
  it("does not let a future vintage change an earlier forecast", () => {
    const levels = observedLevels(Array.from({ length: 48 }, (_, index) => 100 + index));
    const clean = runHousePriceForecast({ seriesId: "test", region: "CZ", levels, horizonQuarters: 1 });
    const leaked = [...levels, {
      period: levels[10].period,
      level: 1_000_000,
      vintageDate: addDays(levels[10].period, 5_000),
      quality: "OBSERVED_VINTAGE" as const,
    }];
    const dirty = runHousePriceForecast({ seriesId: "test", region: "CZ", levels: leaked, horizonQuarters: 1 });
    expect(clean.scoredOrigins).toBe(dirty.scoredOrigins);
    expect(clean.comparisons.map((row) => row.mae)).toEqual(dirty.comparisons.map((row) => row.mae));
  });

  it("issues an unpromotable persistence forecast when nothing beats it", () => {
    const levels = observedLevels(Array.from({ length: 48 }, () => 100));
    const report = runHousePriceForecast({ seriesId: "flat", region: "CZ", levels, horizonQuarters: 1 });
    expect(report.scoredOrigins).toBeGreaterThanOrEqual(20);
    expect(report.claim).toBe("NO_EDGE");
    expect(report.issuedModel).toBe("PERSIST");
    expect(report.issued?.p50).toBeCloseTo(0);
    expect(report.promotable).toBe(false);
  });

  it("lets a real leading rate replace persistence and refuses an assumed-lag promotion", () => {
    const rateValues = Array.from({ length: 56 }, (_, index) => 2 + ((index * 5) % 9) / 2);
    const levels: number[] = [100, 100];
    for (let index = 1; index < rateValues.length - 1; index += 1) {
      const futureReturn = 0.04 * (rateValues[index] - rateValues[index - 1]);
      levels.push(levels[index] * Math.exp(futureReturn));
    }
    const prices = observedLevels(levels).map((row) => ({ ...row, quality: "PUBLICATION_LAG_ASSUMED" as const }));
    const rates = observedLevels(rateValues);
    const report = runHousePriceForecast({ seriesId: "hpi", region: "CZ", levels: prices, rates, horizonQuarters: 1 });
    expect(report.claim).toBe("EDGE");
    expect(report.champion).toBe("RATE_LAG");
    expect(report.issuedModel).toBe("RATE_LAG");
    expect(report.promotable).toBe(false);
    expect(report.issued && report.issued.p10 <= report.issued.p50 && report.issued.p50 <= report.issued.p90).toBe(true);
    const rate = report.comparisons.find((row) => row.modelId === "RATE_LAG");
    expect(rate?.significant).toBe(true);
    expect(rate?.mae).toBeLessThan((rate?.benchmarkMae ?? 1) / 10);
  });

  it("keeps an autoregressive return ahead of persistence", () => {
    const returns: number[] = [0.02];
    for (let index = 1; index < 52; index += 1) returns.push(0.005 + 0.8 * returns[index - 1]);
    const levels = [100];
    for (const value of returns) levels.push(levels[levels.length - 1] * Math.exp(value));
    const report = runHousePriceForecast({
      seriesId: "ar",
      region: "CZ",
      levels: observedLevels(levels),
      horizonQuarters: 1,
    });
    expect(report.champion).toBe("AR1");
    expect(report.claim).toBe("EDGE");
    expect(report.promotable).toBe(true);
  });
});
