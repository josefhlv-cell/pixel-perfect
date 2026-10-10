import { describe, expect, it } from "vitest";
import { nextBestObservation, updateHypothesisWeights } from "./hypothesis-engine";

describe("Future OS hypothesis engine", () => {
  it("normalizes competing hypotheses into posterior weights", () => {
    const result = updateHypothesisWeights([
      { key: "recovery", prior: 0.5, evidenceFor: 3, evidenceAgainst: 1, modelConfidence: 0.9 },
      { key: "correction", prior: 0.5, evidenceFor: 1, evidenceAgainst: 3, modelConfidence: 0.9 },
    ]);
    expect(result[0]!.posterior).toBeGreaterThan(result[1]!.posterior);
    expect(result.reduce((s, x) => s + x.posterior, 0)).toBeCloseTo(1);
  });

  it("selects the observation that best separates futures", () => {
    const result = nextBestObservation(
      [
        { key: "recovery", prior: 0.5, evidenceFor: 1, evidenceAgainst: 0, modelConfidence: 1 },
        { key: "correction", prior: 0.5, evidenceFor: 0, evidenceAgainst: 1, modelConfidence: 1 },
      ],
      [
        { key: "weak", reliability: 0.9, cost: 1, latencyDays: 1, discrimination: { recovery: 0.5, correction: 0.4 } },
        { key: "strong", reliability: 0.9, cost: 1, latencyDays: 1, discrimination: { recovery: 1, correction: 0 } },
      ],
    );
    expect(result[0]!.key).toBe("strong");
  });
});
