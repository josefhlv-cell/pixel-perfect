export type TrajectoryNode = {
  id: string;
  label: string;
  timestamp: string;
  state: number;
  uncertainty?: number;
};

export type TrajectoryEdge = {
  id: string;
  from: string;
  to: string;
  direction: -1 | 1;
  /**
   * Conditional probability P(to | current state), not a marginal probability.
   * Multiplication across a fixed ordered path therefore represents a joint
   * probability via the chain rule, not an independence assumption.
   */
  probability: number;
  leadDays: number;
  evidenceStrength: number;
  /**
   * Association strength only. Do not interpret as causal identification
   * unless the experiment supplies stronger identification evidence.
   */
  associationStrength: number;
  survival: number;
};

export type PathSurvivalAggregation = "GEOMETRIC_MEAN";

export const PATH_SURVIVAL_AGGREGATION: PathSurvivalAggregation =
  "GEOMETRIC_MEAN";

export type FutureTrajectory = {
  id: string;
  nodes: TrajectoryNode[];
  edges: TrajectoryEdge[];
  pathProbability: number;
  pathSurvival: number;
  pathLength: number;
  bottleneckEdgeId: string | null;
  earliestBreakRisk: number;
  status: "VIABLE" | "FRAGILE" | "BROKEN";
};

function edgeRobustness(edge: TrajectoryEdge): number {
  return (
    edge.survival *
    (0.5 * edge.evidenceStrength + 0.5 * edge.associationStrength)
  );
}

function geometricMean(values: number[]): number {
  if (!values.length) return 0;
  if (values.some((value) => value <= 0)) return 0;
  return Math.exp(
    values.reduce((sum, value) => sum + Math.log(value), 0) / values.length,
  );
}

export function evaluateFutureTrajectory(
  id: string,
  nodes: TrajectoryNode[],
  edges: TrajectoryEdge[],
): FutureTrajectory {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const validEdges = edges.filter(
    (edge) =>
      nodeIds.has(edge.from) &&
      nodeIds.has(edge.to) &&
      edge.probability >= 0 &&
      edge.probability <= 1 &&
      edge.survival >= 0 &&
      edge.survival <= 1 &&
      edge.evidenceStrength >= 0 &&
      edge.evidenceStrength <= 1 &&
      edge.associationStrength >= 0 &&
      edge.associationStrength <= 1,
  );

  if (!validEdges.length) {
    return {
      id,
      nodes,
      edges: validEdges,
      pathProbability: 0,
      pathSurvival: 0,
      pathLength: 0,
      bottleneckEdgeId: null,
      earliestBreakRisk: 1,
      status: "BROKEN",
    };
  }

  // Conditional edge probabilities are multiplied only to obtain the joint
  // probability of the fixed ordered path. They are not treated as
  // independent marginal probabilities.
  const pathProbability = validEdges.reduce(
    (value, edge) => value * edge.probability,
    1,
  );

  const robustness = validEdges.map(edgeRobustness);

  // Preregistered aggregation: geometric mean. This is length-normalized,
  // unlike a raw product, while preserving multiplicative penalties.
  const pathSurvival = geometricMean(robustness);

  const bottleneck = validEdges.reduce((weakest, edge) => {
    const score = edgeRobustness(edge);
    if (!weakest) return { edge, score };
    return score < weakest.score ? { edge, score } : weakest;
  }, null as { edge: TrajectoryEdge; score: number } | null);

  const earliestBreakRisk = bottleneck ? 1 - bottleneck.score : 1;
  const status =
    pathSurvival >= 0.65
      ? "VIABLE"
      : pathSurvival >= 0.35
        ? "FRAGILE"
        : "BROKEN";

  return {
    id,
    nodes,
    edges: validEdges,
    pathProbability,
    pathSurvival,
    pathLength: validEdges.length,
    bottleneckEdgeId: bottleneck?.edge.id ?? null,
    earliestBreakRisk,
    status,
  };
}

/**
 * A trajectory is deliberately different from a forecast:
 * it records the intermediate transitions required for a forecast to occur.
 * The bottleneck is a preregistered diagnostic, not a claim of causal
 * identification. H2 tests whether this diagnostic has out-of-sample value.
 */
export function findTrajectoryBottleneck(
  trajectory: FutureTrajectory,
): TrajectoryEdge | null {
  if (!trajectory.bottleneckEdgeId) return null;
  return (
    trajectory.edges.find((edge) => edge.id === trajectory.bottleneckEdgeId) ??
    null
  );
}
