export type NodeSpec = {
  id: string;
  label: string;
  sourceId: string;
  seriesId: string;
  transform: string;
  publicationLagDays: number;
  dataTier: "OBSERVED" | "ASSUMED";
  thresholdLow: number;
  thresholdHigh: number;
  unit: string;
};

export type EdgeSpec = {
  id: string;
  from: string;
  to: string;
  direction: -1 | 1;
  lagMonthsMin: number;
  lagMonthsMax: number;
  primaryForH2: boolean;
  literatureSupport: "SUPPORTED" | "HYPOTHESIS";
};

export type PreregisteredTrajectorySpecification = {
  version: string;
  nodes: readonly NodeSpec[];
  edges: readonly EdgeSpec[];
  primaryH2EdgeIds: readonly string[];
  bottleneckRule: {
    aggregation: "GEOMETRIC_MEAN";
    edgeRobustness: "SURVIVAL_X_EVIDENCE_ASSOCIATION";
    tieBreak: "LEXICOGRAPHIC_EDGE_ID";
    minimumSeparation: number;
  };
};

export const PRIMARY_H2_GRAPH_VERSION = "housing-primary-h2-v0.1" as const;

export const PRIMARY_H2_NODE_SPECS = [
  {
    id: "MONETARY_CONDITIONS",
    label: "Monetary conditions",
    sourceId: "CNB_ARAD",
    seriesId: "CNB_POLICY_RATE",
    transform: "LEVEL",
    publicationLagDays: 1,
    dataTier: "ASSUMED",
    thresholdLow: -1,
    thresholdHigh: 1,
    unit: "percentage_points_vs_training_baseline",
  },
  {
    id: "MORTGAGE_CREDIT",
    label: "Mortgage rate / housing credit conditions",
    sourceId: "CNB_ARAD",
    seriesId: "HOUSE_PURCHASE_LOAN_RATE",
    transform: "LEVEL",
    publicationLagDays: 45,
    dataTier: "ASSUMED",
    thresholdLow: -1,
    thresholdHigh: 1,
    unit: "percentage_points_vs_training_baseline",
  },
  {
    id: "BUYER_DEMAND",
    label: "Demand for housing loans",
    sourceId: "CNB_BLS",
    seriesId: "HOUSEHOLD_HOUSING_LOAN_DEMAND",
    transform: "INDEX",
    publicationLagDays: 60,
    dataTier: "ASSUMED",
    thresholdLow: -1,
    thresholdHigh: 1,
    unit: "standardized_training_index",
  },
  {
    id: "TRANSACTIONS",
    label: "Housing transaction activity",
    sourceId: "CZSO",
    seriesId: "HOUSING_TRANSACTIONS",
    transform: "YOY_CHANGE",
    publicationLagDays: 60,
    dataTier: "ASSUMED",
    thresholdLow: -1,
    thresholdHigh: 1,
    unit: "standardized_training_change",
  },
] as const satisfies readonly NodeSpec[];

export const PRIMARY_H2_EDGE_SPECS = [
  {
    id: "MONETARY_TO_MORTGAGE",
    from: "MONETARY_CONDITIONS",
    to: "MORTGAGE_CREDIT",
    direction: -1,
    lagMonthsMin: 1,
    lagMonthsMax: 6,
    primaryForH2: true,
    literatureSupport: "SUPPORTED",
  },
  {
    id: "MORTGAGE_TO_BUYER_DEMAND",
    from: "MORTGAGE_CREDIT",
    to: "BUYER_DEMAND",
    direction: -1,
    lagMonthsMin: 1,
    lagMonthsMax: 6,
    primaryForH2: true,
    literatureSupport: "SUPPORTED",
  },
  {
    id: "BUYER_DEMAND_TO_TRANSACTIONS",
    from: "BUYER_DEMAND",
    to: "TRANSACTIONS",
    direction: 1,
    lagMonthsMin: 1,
    lagMonthsMax: 6,
    primaryForH2: true,
    literatureSupport: "HYPOTHESIS",
  },
] as const satisfies readonly EdgeSpec[];

export const PRIMARY_H2_SPEC = {
  version: PRIMARY_H2_GRAPH_VERSION,
  nodes: PRIMARY_H2_NODE_SPECS,
  edges: PRIMARY_H2_EDGE_SPECS,
  primaryH2EdgeIds: PRIMARY_H2_EDGE_SPECS.map((edge) => edge.id),
  bottleneckRule: {
    aggregation: "GEOMETRIC_MEAN",
    edgeRobustness: "SURVIVAL_X_EVIDENCE_ASSOCIATION",
    tieBreak: "LEXICOGRAPHIC_EDGE_ID",
    minimumSeparation: 0.05,
  },
} as const;

export function validateNodeSpec(node: NodeSpec): void {
  if (!node.id || !node.label || !node.sourceId || !node.seriesId) {
    throw new Error("Node specification requires id, label, sourceId and seriesId.");
  }
  if (!node.transform || !node.unit) {
    throw new Error(`Node ${node.id} is missing transform or unit.`);
  }
  if (!Number.isInteger(node.publicationLagDays) || node.publicationLagDays < 0) {
    throw new Error(`Node ${node.id} has invalid publication lag.`);
  }
  if (node.dataTier !== "OBSERVED" && node.dataTier !== "ASSUMED") {
    throw new Error(`Node ${node.id} has invalid data tier.`);
  }
  if (
    !Number.isFinite(node.thresholdLow) ||
    !Number.isFinite(node.thresholdHigh) ||
    node.thresholdLow >= node.thresholdHigh
  ) {
    throw new Error(`Node ${node.id} has invalid thresholds.`);
  }
}

export function validateTrajectorySpecification(
  specification: PreregisteredTrajectorySpecification,
): void {
  if (!specification.version) throw new Error("Trajectory specification requires a version.");
  specification.nodes.forEach(validateNodeSpec);

  const nodeIds = new Set(specification.nodes.map((node) => node.id));
  const edgeIds = new Set<string>();

  for (const edge of specification.edges) {
    if (edgeIds.has(edge.id)) throw new Error(`Duplicate edge: ${edge.id}`);
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      throw new Error(`Unknown edge endpoint for ${edge.id}.`);
    }
    if (edge.direction !== -1 && edge.direction !== 1) {
      throw new Error(`Invalid direction for ${edge.id}.`);
    }
    if (
      !Number.isInteger(edge.lagMonthsMin) ||
      !Number.isInteger(edge.lagMonthsMax) ||
      edge.lagMonthsMin < 0 ||
      edge.lagMonthsMin > edge.lagMonthsMax
    ) {
      throw new Error(`Invalid lag range for ${edge.id}.`);
    }
  }

  for (const id of specification.primaryH2EdgeIds) {
    const edge = specification.edges.find((candidate) => candidate.id === id);
    if (!edge || !edge.primaryForH2) {
      throw new Error(`Primary H2 edge is not declared in the graph: ${id}`);
    }
  }

  const separation = specification.bottleneckRule.minimumSeparation;
  if (!Number.isFinite(separation) || separation < 0 || separation > 1) {
    throw new Error("Invalid bottleneck minimum separation.");
  }
}

export function selectBottleneckEdge(
  edges: readonly { edgeId: string; robustness: number }[],
  rule: Pick<PreregisteredTrajectorySpecification["bottleneckRule"], "minimumSeparation" | "tieBreak">,
): string | null {
  if (!edges.length) return null;
  const ordered = [...edges].sort(
    (a, b) => a.robustness - b.robustness || a.edgeId.localeCompare(b.edgeId),
  );
  if (ordered.length === 1) return ordered[0].edgeId;

  const separation = ordered[1].robustness - ordered[0].robustness;
  if (separation < rule.minimumSeparation) return null;

  if (rule.tieBreak !== "LEXICOGRAPHIC_EDGE_ID") {
    throw new Error(`Unsupported bottleneck tie-break: ${rule.tieBreak}`);
  }
  return ordered[0].edgeId;
}

export function assertPrimaryGraphMatchesPreregistration(): void {
  const expected = PRIMARY_H2_EDGE_SPECS.map((edge) => edge.id);
  if (
    expected.length !== 3 ||
    JSON.stringify(expected) !== JSON.stringify(PRIMARY_H2_SPEC.primaryH2EdgeIds)
  ) {
    throw new Error("Primary H2 graph differs from its canonical edge specification.");
  }
}
