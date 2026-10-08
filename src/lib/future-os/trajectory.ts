export type TrajectoryNode = {
  id: string;
  label: string;
  timestamp: string;
  state: number;
  uncertainty?: number;
};

export type TrajectoryEdge = {
  from: string;
  to: string;
  direction: -1 | 1;
  probability: number;
  leadDays: number;
  evidenceStrength: number;
  causalStrength: number;
  survival: number;
};

export type FutureTrajectory = {
  id: string;
  nodes: TrajectoryNode[];
  edges: TrajectoryEdge[];
  pathProbability: number;
  pathSurvival: number;
  bottleneckEdgeId: string | null;
  earliestBreakRisk: number;
  status: "VIABLE" | "FRAGILE" | "BROKEN";
};

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
      edge.causalStrength >= 0 &&
      edge.causalStrength <= 1,
  );

  if (!validEdges.length) {
    return {
      id,
      nodes,
      edges: validEdges,
      pathProbability: 0,
      pathSurvival: 0,
      bottleneckEdgeId: null,
      earliestBreakRisk: 1,
      status: "BROKEN",
    };
  }

  const pathProbability = validEdges.reduce(
    (value, edge) => value * edge.probability,
    1,
  );

  // The weakest link is intentional: a long causal chain is only as robust
  // as its most fragile transition. This is not a probability of the future.
  const pathSurvival = Math.min(
    ...validEdges.map(
      (edge) =>
        edge.survival *
        (0.5 * edge.evidenceStrength + 0.5 * edge.causalStrength),
    ),
  );

  const bottleneck = validEdges.reduce((weakest, edge) => {
    const score =
      edge.survival *
      (0.5 * edge.evidenceStrength + 0.5 * edge.causalStrength);
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
    bottleneckEdgeId: bottleneck?.edge.id ?? null,
    earliestBreakRisk,
    status,
  };
}

/**
 * A trajectory is deliberately different from a forecast:
 * it records the intermediate transitions required for a forecast to occur.
 * If a high-value terminal forecast has a weak intermediate edge, the engine
 * must expose that edge instead of hiding it inside one confidence number.
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