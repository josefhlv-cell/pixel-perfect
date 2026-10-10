import { describe, expect, it } from "vitest";
import { compareForecastToBenchmark, type ForecastEvaluationSample } from "./forecast-evaluation";

function samples(): ForecastEvaluationSample[] {
  return Array.from({ length: 24 }, (_, index) => ({
    actual: index % 2 === 0 ? 0.04 : -0.02,
    baselineActual: 0,
    candidate: { p50: 0.01, probabilityPositive: 0.6 },
    benchmark: { p50: 0, probabilityPositive: 0.5 },
  }));
}

describe("forecast evaluation input validation", () => {
  it("returns no score when a probability is outside [0, 1]", () => {
    const data = samples();
    data[0].candidate.probabilityPositive = 1.2;
    expect(compareForecastToBenchmark(data, "BRIER")).toBeNull();
  });

  it("returns no score when a probability is not finite", () => {
    const data = samples();
    data[0].benchmark.probabilityPositive = Number.NaN;
    expect(compareForecastToBenchmark(data, "LOG_LOSS")).toBeNull();
  });

  it("evaluates valid probabilities including exact zero and one", () => {
    const data = samples();
    data[0].candidate.probabilityPositive = 0;
    data[1].candidate.probabilityPositive = 1;
    expect(compareForecastToBenchmark(data, "BRIER")).not.toBeNull();
  });
});
