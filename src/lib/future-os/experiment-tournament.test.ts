import { describe, expect, it } from "vitest";
import { championFromExperiments, rankExperiments } from "./experiment-tournament";

describe("Experiment tournament", () => {
  it("prefers the model with lower out-of-sample loss", () => {
    const results = rankExperiments([
      { modelKey: "A", horizonDays: 365, sampleCount: 20, mae: 2, rmse: 3, directionalAccuracy: .7, intervalCoverage: .9, brier: .2, logLoss: .3, regret: 1, driftPenalty: 0 },
      { modelKey: "B", horizonDays: 365, sampleCount: 20, mae: 1, rmse: 2, directionalAccuracy: .8, intervalCoverage: .9, brier: .1, logLoss: .2, regret: .5, driftPenalty: 0 },
    ]);
    expect(results[0].modelKey).toBe("B");
  });

  it("does not crown a champion with too little history", () => {
    const result = championFromExperiments([
      { modelKey: "A", horizonDays: 365, sampleCount: 4, mae: 0, rmse: 0, directionalAccuracy: 1, intervalCoverage: 1, brier: 0, logLoss: 0, regret: 0, driftPenalty: 0 },
    ]);
    expect(result).toBeNull();
  });
});
