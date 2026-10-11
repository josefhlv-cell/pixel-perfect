import { describe, expect, it } from "vitest";
import { selectChampion, tournamentScore } from "./model-tournament";

describe("Future OS model tournament", () => {
  it("does not crown models with too little evidence", () => {
    expect(
      tournamentScore({
        modelId: "weak",
        mae: 1,
        rmse: 1,
        directionalAccuracy: 0.8,
        intervalCoverage: 0.9,
        brierScore: 0.1,
        decisionUtility: 1,
        regret: 0,
        calibrationError: 0,
        driftPenalty: 0,
        robustnessScore: 1,
        sampleCount: 9,
      }),
    ).toBeNull();
  });

  it("selects a champion by out-of-sample score", () => {
    const winner = selectChampion([
      {
        modelId: "a",
        mae: 0.5,
        rmse: 0.8,
        directionalAccuracy: 0.75,
        intervalCoverage: 0.9,
        brierScore: 0.12,
        decisionUtility: 2,
        regret: 0.1,
        calibrationError: 0.05,
        driftPenalty: 0.02,
        robustnessScore: 0.8,
        sampleCount: 100,
      },
      {
        modelId: "b",
        mae: 2,
        rmse: 2.5,
        directionalAccuracy: 0.55,
        intervalCoverage: 0.4,
        brierScore: 0.3,
        decisionUtility: 0.5,
        regret: 0.5,
        calibrationError: 0.2,
        driftPenalty: 0.2,
        robustnessScore: 0.4,
        sampleCount: 100,
      },
    ]);
    expect(winner?.modelId).toBe("a");
  });
});
