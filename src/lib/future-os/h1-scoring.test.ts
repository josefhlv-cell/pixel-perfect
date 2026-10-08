import { describe, expect, it } from "vitest";
import { combinedScenarioScore, scoreScenarioRanking } from "./h1-scoring";

describe("H1 scoring", () => {
  it("uses the preregistered p * survival * information structure", () => {
    expect(combinedScenarioScore(0.8, 0.7, 0.6)).toBeCloseTo(0.336);
  });

  it("scores ranking without changing the input rows", () => {
    const rows = [
      { scenarioId:"up", probability:0.7, stressScore:0.9, information:0.8, realized:true },
      { scenarioId:"down", probability:0.3, stressScore:0.8, information:0.7, realized:false },
    ];
    const result = scoreScenarioRanking(rows);
    expect(result.brier).toBeGreaterThanOrEqual(0);
    expect(result.selectedScenarioRate).toBe(1);
  });

  it("rejects invalid probability", () => {
    expect(() => combinedScenarioScore(1.1, 0.5, 0.5)).toThrow();
  });
});
