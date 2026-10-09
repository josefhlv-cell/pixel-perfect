import { describe, expect, it } from "vitest";
import { selectChampion, tournamentScore } from "./model-tournament";

describe("Future OS model tournament", () => {
  it("does not crown models with too little evidence", () => {
    expect(tournamentScore({
      modelId: "weak", mae: 1, rmse: 1, directionalAccuracy: .8,
      intervalCoverage: .9, brierScore: .1, decisionUtility: 1, regret: 0,
      calibrationError: 0, driftPenalty: 0, robustnessScore: 1, sampleCount: 9,
    })).toBeNull();
  });

  it("selects a champion by out-of-sample score", () => {
    const winner = selectChampion([
      {
        modelId: "a", mae: .5, rmse: .8, directionalAccuracy: .75,
        intervalCoverage: .9, brierScore: .12, decisionUtility: 2, regret: .1,
        calibrationError: .05, driftPenalty: .02, robustnessScore: .8, sampleCount: 100,
      },
      {
        modelId: "b", mae: 2, rmse: 2.5, directionalAccuracy: .55,
        intervalCoverage: .4, brierScore: .3, decisionUtility: .5, regret: .5,
        calibrationError: .2, driftPenalty: .2, robustnessScore: .4, sampleCount: 100,
      },
    ]);
    expect(winner?.modelId).toBe("a");
  });
});
