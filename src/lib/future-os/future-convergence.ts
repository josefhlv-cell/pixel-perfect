export type FutureCausalEdge = {
  from: string;
  to: string;
  sign: 1 | -1;
  strength: number;
  lagDays: number;
  independenceGroup: string;
};

export type PrecursorSignal = {
  node: string;
  value: number;
  reliability: number;
  independenceGroup: string;
};

export type FutureConvergence = {
  target: string;
  direction: 1 | -1;
  independentPathCount: number;
  supportingPathCount: number;
  convergenceScore: number;
  earliestImpactDays: number | null;
  medianImpactDays: number | null;
  fragility: number;
  supportingGroups: string[];
  paths: Array<{
    nodes: string[];
    direction: 1 | -1;
    impactDays: number;
    strength: number;
    independenceGroup: string;
  }>;
};

/**
 * Future Convergence Engine
 *
 * Instead of asking which single indicator predicts the target, this engine
 * looks for independent causal paths that converge on the same future target.
 *
 * A convergence is stronger when:
 * - several causal paths agree on direction,
 * - their evidence comes from independent groups,
 * - the paths are individually strong,
 * - and the predicted impacts arrive on compatible time scales.
 *
 * This is deliberately not called causal proof. It is a structural forecasting
 * score that can be falsified later by point-in-time outcomes.
 */
export function detectFutureConvergence(
  target: string,
  edges: FutureCausalEdge[],
  signals: PrecursorSignal[],
  maxDepth = 6,
): FutureConvergence[] {
  const adjacency = new Map<string, FutureCausalEdge[]>();
  for (const edge of edges) {
    const list = adjacency.get(edge.from) ?? [];
    list.push(edge);
    adjacency.set(edge.from, list);
  }

  const paths: FutureConvergence["paths"] = [];
  for (const signal of signals) {
    walk(
      signal.node,
      target,
      adjacency,
      new Set<string>(),
      [],
      0,
      1,
      signal.reliability,
      signal.independenceGroup,
      maxDepth,
      paths,
    );
  }

  const grouped = new Map<string, typeof paths>();
  for (const path of paths) {
    const key = `${target}:${path.direction}`;
    const list = grouped.get(key) ?? [];
    list.push(path);
    grouped.set(key, list);
  }

  return [...grouped.entries()].map(([key, group]) => {
    const uniqueByGroup = new Map<string, (typeof paths)[number]>();
    for (const path of group) {
      const existing = uniqueByGroup.get(path.independenceGroup);
      if (!existing || path.strength > existing.strength) {
        uniqueByGroup.set(path.independenceGroup, path);
      }
    }

    const independent = [...uniqueByGroup.values()]
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 12);

    const pathCount = independent.length;
    const strengthMass = independent.reduce((sum, path) => sum + path.strength, 0);
    const directionAgreement = pathCount ? Math.min(1, pathCount / 4) : 0;
    const convergenceScore = Math.min(
      1,
      (1 - Math.exp(-strengthMass)) * (0.45 + 0.55 * directionAgreement),
    );

    const impacts = independent.map(path => path.impactDays).sort((a, b) => a - b);
    const medianImpactDays = impacts.length
      ? impacts[Math.floor((impacts.length - 1) / 2)]
      : null;

    // Fragility asks: how much of the supporting mass disappears if the
    // strongest independent path is removed?
    const total = independent.reduce((sum, path) => sum + path.strength, 0);
    const strongest = independent[0]?.strength ?? 0;
    const fragility = total ? Math.min(1, strongest / total) : 1;

    return {
      target,
      direction: (key.endsWith(":1") ? 1 : -1) as 1 | -1,
      independentPathCount: pathCount,
      supportingPathCount: group.length,
      convergenceScore,
      earliestImpactDays: impacts[0] ?? null,
      medianImpactDays: medianImpactDays ?? null,
      fragility,
      supportingGroups: independent.map(path => path.independenceGroup),
      paths: independent,
    };
  }).sort((a, b) => b.convergenceScore - a.convergenceScore);
}

function walk(
  current: string,
  target: string,
  adjacency: Map<string, FutureCausalEdge[]>,
  visited: Set<string>,
  nodes: string[],
  impactDays: number,
  direction: 1 | -1,
  strength: number,
  independenceGroup: string,
  remainingDepth: number,
  out: FutureConvergence["paths"],
) {
  if (remainingDepth < 0 || visited.has(current)) return;
  if (current === target && nodes.length) {
    out.push({
      nodes: [...nodes, target],
      direction,
      impactDays,
      strength: Math.max(0, Math.min(1, strength)),
      independenceGroup,
    });
    return;
  }

  const nextVisited = new Set(visited);
  nextVisited.add(current);

  for (const edge of adjacency.get(current) ?? []) {
    walk(
      edge.to,
      target,
      adjacency,
      nextVisited,
      [...nodes, current],
      impactDays + Math.max(0, edge.lagDays),
      direction === 1 ? edge.sign : (edge.sign === 1 ? -1 : 1),
      strength * clamp(edge.strength),
      independenceGroup,
      remainingDepth - 1,
      out,
    );
  }
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

/**
 * Converts convergence into an operational early-warning level.
 * High convergence with low fragility is preferred over a single dominant path.
 */
export function convergenceWarningLevel(result: FutureConvergence): "NONE" | "WATCH" | "EARLY_WARNING" | "BREAK" {
  if (result.independentPathCount >= 3 && result.convergenceScore >= 0.72 && result.fragility <= 0.55) {
    return "EARLY_WARNING";
  }
  if (result.independentPathCount >= 2 && result.convergenceScore >= 0.48) {
    return "WATCH";
  }
  return "NONE";
}
