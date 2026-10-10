import { describe, expect, it } from "vitest";
import { evaluateProbabilisticForecasts, type ProbabilisticForecastObservation } from "./probabilistic-metrics";

function row(overrides: Partial<ProbabilisticForecastObservation> = {}): ProbabilisticForecastObservation {
  return {
    issuedAt: "2025-01-01T00:00:00Z",
    outcomeObservedAt: "2025-02-01T00:00:00Z",
    actual: 2,
    p10: 0,
    p50: 2,
    p90: 4,
    probabilityPositive: 0.8,
    baselineValue: 1,
    ...overrides,
  };
}

describe("probabilistic forecast diagnostics", () => {
  it("computes point error, coverage, sharpness and proper probability scores", () => {
    const result = evaluateProbabilisticForecasts([row()], "2025-03-01T00:00:00Z");
    expect(result.sampleCount).toBe(1);
    expect(result.mae).toBe(0);
    expect(result.meanBias).toBe(0);
    expect(result.intervalCoverage80).toBe(1);
    expect(result.meanIntervalWidth80).toBe(4);
    expect(result.brierScore).toBeCloseTo(0.04);
    expect(result.directionalAccuracy).toBe(1);
    expect(result.calibrationBins.reduce((sum, bin) => sum + bin.sampleCount, 0)).toBe(1);
    expect(result.calibrationBins[0]?.meanPredictedProbability).toBeNull();
    expect(result.calibrationBins[0]?.observedFrequency).toBeNull();
    expect(result.calibrationBins[0]?.observedFrequency).toBeNull();
  });

  it("excludes outcomes that were not known at the evaluation cutoff", () => {
    const result = evaluateProbabilisticForecasts([
      row(),
      row({ outcomeObservedAt: "2025-04-01T00:00:00Z", actual: 100 }),
    ], "2025-03-01T00:00:00Z");
    expect(result.sampleCount).toBe(1);
    expect(result.mae).toBe(0);
  });

  it("penalizes observations outside the prediction interval", () => {
    const covered = evaluateProbabilisticForecasts([row()], "2025-03-01T00:00:00Z");
    const missed = evaluateProbabilisticForecasts([
      row({ actual: 10 }),
    ], "2025-03-01T00:00:00Z");
    expect(missed.intervalCoverage80).toBe(0);
    expect(missed.intervalScore80).toBeGreaterThan(covered.intervalScore80);
  });

  it("ignores malformed rows instead of corrupting aggregate metrics", () => {
    const result = evaluateProbabilisticForecasts([
      row(),
      row({ probabilityPositive: 2 }),
      row({ p10: Number.NaN }),
    ], "2025-03-01T00:00:00Z");
    expect(result.sampleCount).toBe(1);
  });

  it("returns an explicit empty summary and validates configuration", () => {
    const result = evaluateProbabilisticForecasts([], "2025-03-01T00:00:00Z");
    expect(result.sampleCount).toBe(0);
    expect(result.mae).toBeNull();
    expect(result.brierScore).toBeNull();
    expect(result.calibrationBins).toHaveLength(10);
    expect(result.calibrationBins[0]?.meanPredictedProbability).toBeNull();
    expect(() => evaluateProbabilisticForecasts([], "bad-date")).toThrow(/asOf/);
    expect(() => evaluateProbabilisticForecasts([], "2025-03-01T00:00:00Z", { binCount: 0 })).toThrow(/binCount/);
    expect(() => evaluateProbabilisticForecasts([], "2025-03-01T00:00:00Z", { alpha: 1 })).toThrow(/alpha/);
  });
});
