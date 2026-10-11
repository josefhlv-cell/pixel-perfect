import { describe, expect, it } from "vitest";
import { championFromExperiments, rankExperiments } from "./experiment-tournament";

describe("Experiment tournament", () => {
  it("prefers the model with lower out-of-sample loss", () => {
    const results = rankExperiments([
      {
        modelKey: "A",
        horizonDays: 365,
        sampleCount: 20,
        mae: 2,
        rmse: 3,
        directionalAccuracy: 0.7,
        intervalCoverage: 0.9,
        brier: 0.2,
        logLoss: 0.3,
        regret: 1,
        driftPenalty: 0,
      },
      {
        modelKey: "B",
        horizonDays: 365,
        sampleCount: 20,
        mae: 1,
        rmse: 2,
        directionalAccuracy: 0.8,
        intervalCoverage: 0.9,
        brier: 0.1,
        logLoss: 0.2,
        regret: 0.5,
        driftPenalty: 0,
      },
    ]);
    expect(results[0]!.modelKey).toBe("B");
  });

  it("does not crown a champion with too little history", () => {
    const result = championFromExperiments([
      {
        modelKey: "A",
        horizonDays: 365,
        sampleCount: 4,
        mae: 0,
        rmse: 0,
        directionalAccuracy: 1,
        intervalCoverage: 1,
        brier: 0,
        logLoss: 0,
        regret: 0,
        driftPenalty: 0,
      },
    ]);
    expect(result).toBeNull();
  });
});
