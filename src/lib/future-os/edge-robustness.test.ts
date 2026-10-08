import { describe, expect, it } from "vitest";
import { computeEdgeRobustness } from "./edge-robustness";

describe("edge robustness", () => {
  it("does not reward or penalize HYPOTHESIS status", () => {
    const components = { survival: 0.8, evidence: 0.7, association: 0.6 };
    const supported = computeEdgeRobustness(components, "SUPPORTED");
    const hypothesis = computeEdgeRobustness(components, "HYPOTHESIS");
    expect(hypothesis.score).toBe(supported.score);
    expect(hypothesis.normalization).toBe("TRAINING_QUANTILE_0_1");
  });

  it("rejects values outside the preregistered [0,1] scale", () => {
    expect(() =>
      computeEdgeRobustness(
        { survival: 1.2, evidence: 0.5, association: 0.5 },
        "HYPOTHESIS",
      ),
    ).toThrow();
  });
});
