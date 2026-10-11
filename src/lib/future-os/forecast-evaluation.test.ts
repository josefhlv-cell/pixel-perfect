import { describe, expect, it } from "vitest";
import { compareForecastToBenchmark, type ForecastEvaluationSample } from "./forecast-evaluation";

const sample = (candidateP50: number, benchmarkP50: number): ForecastEvaluationSample => ({
  actual: 110,
  baselineActual: 100,
  candidate: { p50: candidateP50, probabilityPositive: 0.8 },
  benchmark: { p50: benchmarkP50, probabilityPositive: 0.6 },
});

describe("paired forecast evaluation", () => {
  it("does not claim a benchmark win with fewer than 20 paired samples", () => {
    expect(
      compareForecastToBenchmark(
        Array.from({ length: 19 }, () => sample(110, 105)),
        "MAE",
      ),
    ).toBeNull();
  });

  it("detects a consistent out-of-sample MAE improvement over the baseline", () => {
    const result = compareForecastToBenchmark(
      Array.from({ length: 24 }, () => sample(110, 105)),
      "MAE",
      4,
      500,
    );

    expect(result).not.toBeNull();
    expect(result!.candidateMean).toBe(0);
    expect(result!.benchmarkMean).toBe(5);
    expect(result!.improvement).toBe(5);
    expect(result!.significant).toBe(true);
  });

  it("keeps probabilistic scores bounded for extreme probabilities", () => {
    const samples = Array.from({ length: 20 }, () => ({
      ...sample(110, 110),
      candidate: { p50: 110, probabilityPositive: 1 },
      benchmark: { p50: 110, probabilityPositive: 0 },
    }));
    const result = compareForecastToBenchmark(samples, "LOG_LOSS", 4, 200);

    expect(result).not.toBeNull();
    expect(Number.isFinite(result!.candidateMean)).toBe(true);
    expect(Number.isFinite(result!.benchmarkMean)).toBe(true);
  });
});
