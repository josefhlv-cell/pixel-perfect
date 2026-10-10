import { describe, expect, it } from "vitest";
import { compareForecastToBenchmark, type ForecastEvaluationSample } from "./forecast-evaluation";

function samples(count = 24): ForecastEvaluationSample[] {
  return Array.from({ length: count }, (_, i) => ({
    actual: 100 + (i % 2 ? 4 : -3),
    baselineActual: 100,
    candidate: { p50: 100 + (i % 2 ? 3 : -2), probabilityPositive: i % 2 ? 0.8 : 0.2 },
    benchmark: { p50: 100, probabilityPositive: 0.5 },
  }));
}

describe("forecast comparison", () => {
  it("returns null when there are too few paired outcomes", () => {
    expect(compareForecastToBenchmark(samples(19), "MAE")).toBeNull();
  });

  it("compares candidate and benchmark on the same samples", () => {
    const result = compareForecastToBenchmark(samples(), "MAE");
    expect(result).not.toBeNull();
    expect(result?.candidateMean).toBeLessThan(result!.benchmarkMean);
    expect(result?.bootstrapSamples).toBe(1000);
  });

  it("rejects malformed numeric data instead of returning a score", () => {
    const invalid = samples();
    invalid[0]!.actual = Number.NaN;
    expect(() => compareForecastToBenchmark(invalid, "MAE")).toThrow(/actual must be finite/);
  });

  it("rejects probabilities outside [0, 1]", () => {
    const invalid = samples();
    invalid[0]!.candidate.probabilityPositive = 1.2;
    expect(() => compareForecastToBenchmark(invalid, "BRIER")).toThrow(/between 0 and 1/);
  });

  it("requires enough bootstrap iterations for a meaningful interval", () => {
    expect(() => compareForecastToBenchmark(samples(), "MAE", 4, 10)).toThrow(/iterations/);
  });
});
