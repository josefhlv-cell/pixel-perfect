import { describe, expect, it } from "vitest";
import {
  PREREGISTERED_TRAJECTORY_GRAPH,
  isPreregisteredTrajectoryEdge,
  isPreregisteredTrajectoryNode,
} from "./trajectory-graph";

describe("preregistered trajectory graph", () => {
  it("locks node and edge identities", () => {
    expect(PREREGISTERED_TRAJECTORY_GRAPH.version).toBe("housing-chain-v0.1");
    expect(PREREGISTERED_TRAJECTORY_GRAPH.nodeIds).toHaveLength(8);
    expect(PREREGISTERED_TRAJECTORY_GRAPH.edgeIds).toHaveLength(7);
    expect(PREREGISTERED_TRAJECTORY_GRAPH.pathSurvivalAggregation).toBe("GEOMETRIC_MEAN");
    expect(PREREGISTERED_TRAJECTORY_GRAPH.bottleneckRule).toBe("MIN_EDGE_ROBUSTNESS");
  });

  it("rejects graph elements that are not preregistered", () => {
    expect(isPreregisteredTrajectoryNode("HOUSE_PRICES")).toBe(true);
    expect(isPreregisteredTrajectoryNode("RANDOM_NODE")).toBe(false);
    expect(isPreregisteredTrajectoryEdge("PRICE_PRESSURE_TO_PRICES")).toBe(true);
    expect(isPreregisteredTrajectoryEdge("RANDOM_EDGE")).toBe(false);
  });
});
