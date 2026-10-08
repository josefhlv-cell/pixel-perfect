import { describe, expect, it } from "vitest";
import {
  PREREGISTERED_TRAJECTORY_GRAPH,
  PREREGISTERED_TRAJECTORY_GRAPH_HASH,
  isPreregisteredTrajectoryEdge,
  isPreregisteredTrajectoryNode,
} from "./trajectory-graph";
import { DEFAULT_EXPERIMENT_CONFIG } from "./experiment-config";
import { canonicalizeConfig } from "./experiment-integrity";

describe("preregistered trajectory graph", () => {
  it("locks node and edge identities", () => {
    expect(PREREGISTERED_TRAJECTORY_GRAPH.version).toBe("housing-chain-v0.1");
    expect(PREREGISTERED_TRAJECTORY_GRAPH.nodeIds).toHaveLength(8);
    expect(PREREGISTERED_TRAJECTORY_GRAPH.edgeIds).toHaveLength(9);
    expect(PREREGISTERED_TRAJECTORY_GRAPH.primaryH2EdgeIds).toEqual([
      "MONETARY_TO_MORTGAGE",
      "MORTGAGE_TO_BUYER_DEMAND",
      "BUYER_DEMAND_TO_TRANSACTIONS",
    ]);
    expect(PREREGISTERED_TRAJECTORY_GRAPH.pathSurvivalAggregation).toBe("GEOMETRIC_MEAN");
    expect(PREREGISTERED_TRAJECTORY_GRAPH.bottleneckRule.edgeRobustness).toBe(
      "SURVIVAL_X_EVIDENCE_ASSOCIATION",
    );
  });

  it("rejects graph elements that are not preregistered", () => {
    expect(isPreregisteredTrajectoryNode("HOUSE_PRICES")).toBe(true);
    expect(isPreregisteredTrajectoryNode("RANDOM_NODE")).toBe(false);
    expect(isPreregisteredTrajectoryEdge("PRICE_PRESSURE_TO_PRICES")).toBe(true);
    expect(isPreregisteredTrajectoryEdge("RANDOM_EDGE")).toBe(false);
  });

  it("uses exactly one authoritative graph export", () => {
    expect(PREREGISTERED_TRAJECTORY_GRAPH_HASH).toBe(
      "6e672f913ace3313fff75b5c720d7ec782c87242eb3aa99837caa23eb81ad9e9",
    );
  });

  it("locks the graph hash into the experiment configuration", () => {
    const config = DEFAULT_EXPERIMENT_CONFIG;
    expect(config.trajectoryGraphHash).toBe(PREREGISTERED_TRAJECTORY_GRAPH_HASH);
    expect(canonicalizeConfig(config)).toContain(PREREGISTERED_TRAJECTORY_GRAPH_HASH);
  });
});
