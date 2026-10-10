import { describe, expect, it } from "vitest";
import {
  PREREGISTERED_TRAJECTORY_GRAPH,
  PREREGISTERED_TRAJECTORY_GRAPH_HASH,
  isPreregisteredTrajectoryEdge,
  isPreregisteredTrajectoryNode,
  hashPreregisteredTrajectoryGraph,
} from "./trajectory-graph";
import { PREREGISTERED_TRAJECTORY_GRAPH as LEGACY_GRAPH } from "./preregistered-trajectory";
import { DEFAULT_EXPERIMENT_CONFIG } from "./experiment-config";

describe("preregistered trajectory graph", () => {
  it("locks the single canonical graph identity", async () => {
    expect(PREREGISTERED_TRAJECTORY_GRAPH.version).toBe("housing-chain-v0.1");
    expect(PREREGISTERED_TRAJECTORY_GRAPH.nodeIds).toHaveLength(8);
    expect(PREREGISTERED_TRAJECTORY_GRAPH.edgeIds).toHaveLength(9);
    expect(PREREGISTERED_TRAJECTORY_GRAPH.pathSurvivalAggregation).toBe(
      "GEOMETRIC_MEAN",
    );
    expect(PREREGISTERED_TRAJECTORY_GRAPH.bottleneckRule).toEqual({
      edgeRobustness: "SURVIVAL_X_EVIDENCE_ASSOCIATION",
      tieBreak: "LEXICOGRAPHIC_EDGE_ID",
      minimumSeparation: 0.05,
    });
    expect(await hashPreregisteredTrajectoryGraph()).toBe(
      PREREGISTERED_TRAJECTORY_GRAPH_HASH,
    );
  });

  it("proves the legacy module is only an alias, not a second graph", () => {
    expect(LEGACY_GRAPH).toBe(PREREGISTERED_TRAJECTORY_GRAPH);
  });

  it("locks the graph hash into experiment configuration", () => {
    expect(DEFAULT_EXPERIMENT_CONFIG.trajectory).toBe(
      PREREGISTERED_TRAJECTORY_GRAPH,
    );
    expect(DEFAULT_EXPERIMENT_CONFIG.trajectoryGraphHash).toBe(
      PREREGISTERED_TRAJECTORY_GRAPH_HASH,
    );
  });

  it("rejects graph elements that are not preregistered", () => {
    expect(isPreregisteredTrajectoryNode("HOUSE_PRICES")).toBe(true);
    expect(isPreregisteredTrajectoryNode("RANDOM_NODE")).toBe(false);
    expect(isPreregisteredTrajectoryEdge("PRICE_PRESSURE_TO_PRICES")).toBe(
      true,
    );
    expect(isPreregisteredTrajectoryEdge("RANDOM_EDGE")).toBe(false);
  });
});
