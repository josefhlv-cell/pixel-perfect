import { describe, expect, it } from "vitest";
import {
  selectBottleneckEdge,
  validateNodeSpec,
  validateTrajectorySpecification,
  type NodeSpec,
} from "./trajectory-spec";

const validNode: NodeSpec = {
  id: "RATE",
  label: "Monetary conditions",
  sourceId: "CNB",
  seriesId: "PRIBOR",
  transform: "LEVEL",
  publicationLagDays: 30,
  dataTier: "OBSERVED",
  thresholdLow: -1,
  thresholdHigh: 1,
  unit: "index",
};

describe("trajectory specification", () => {
  it("rejects a node without source or publication lag metadata", () => {
    expect(() => validateNodeSpec({ ...validNode, sourceId: "" })).toThrow();
    expect(() => validateNodeSpec({ ...validNode, publicationLagDays: -1 })).toThrow();
  });

  it("rejects unknown edge endpoints and invalid thresholds", () => {
    expect(() =>
      validateTrajectorySpecification({
        version: "housing-spec-v0.1",
        nodes: [validNode],
        edges: [{ id: "bad", from: "RATE", to: "MISSING", direction: 1, lagMonthsMin: 1, lagMonthsMax: 3, primaryForH2: true, literatureSupport: "HYPOTHESIS" }],
        primaryH2EdgeIds: ["bad"],
        bottleneckRule: { aggregation: "GEOMETRIC_MEAN", edgeRobustness: "SURVIVAL_X_EVIDENCE_ASSOCIATION", tieBreak: "LEXICOGRAPHIC_EDGE_ID", minimumSeparation: 0.05 },
      }),
    ).toThrow();
  });

  it("returns no bottleneck when the two weakest links are too close", () => {
    expect(
      selectBottleneckEdge(
        [
          { edgeId: "a", robustness: 0.40 },
          { edgeId: "b", robustness: 0.43 },
          { edgeId: "c", robustness: 0.80 },
        ],
        { aggregation: "GEOMETRIC_MEAN", edgeRobustness: "SURVIVAL_X_EVIDENCE_ASSOCIATION", tieBreak: "LEXICOGRAPHIC_EDGE_ID", minimumSeparation: 0.05 },
      ),
    ).toBeNull();
  });

  it("uses the preregistered tie-break when separation is sufficient", () => {
    expect(
      selectBottleneckEdge(
        [{ edgeId: "b", robustness: 0.30 }, { edgeId: "a", robustness: 0.60 }],
        { aggregation: "GEOMETRIC_MEAN", edgeRobustness: "SURVIVAL_X_EVIDENCE_ASSOCIATION", tieBreak: "LEXICOGRAPHIC_EDGE_ID", minimumSeparation: 0.05 },
      ),
    ).toBe("b");
  });
});
