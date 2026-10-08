export type DataTier = "OBSERVED" | "ASSUMED";
export type NodeTransform =
  | "LEVEL"
  | "YOY_CHANGE"
  | "MOM_CHANGE"
  | "STANDARDIZED"
  | "INDEX";

export type NodeSpec = {
  id: string;
  label: string;
  sourceId: string;
  seriesId: string;
  transform: NodeTransform;
  publicationLagDays: number;
  dataTier: DataTier;
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

export type BottleneckRule = {
  aggregation: "GEOMETRIC_MEAN";
  edgeRobustness: "SURVIVAL_X_EVIDENCE_ASSOCIATION";
  tieBreak: "LEXICOGRAPHIC_EDGE_ID";
  minimumSeparation: number;
};

export type PreregisteredTrajectorySpecification = {
  version: "housing-spec-v0.1";
  nodes: readonly NodeSpec[];
  edges: readonly EdgeSpec[];
  primaryH2EdgeIds: readonly string[];
  bottleneckRule: BottleneckRule;
};

function assertFinite(value: number, field: string): void {
  if (!Number.isFinite(value)) throw new Error(`${field} must be finite.`);
}

export function validateNodeSpec(node: NodeSpec): void {
  if (!node.id || !node.label || !node.sourceId || !node.seriesId || !node.unit) {
    throw new Error(`Node ${node.id || "<unknown>"} is missing required metadata.`);
  }
  if (node.publicationLagDays < 0 || !Number.isInteger(node.publicationLagDays)) {
    throw new Error(`Node ${node.id} has invalid publicationLagDays.`);
  }
  assertFinite(node.thresholdLow, `${node.id}.thresholdLow`);
  assertFinite(node.thresholdHigh, `${node.id}.thresholdHigh`);
  if (node.thresholdLow >= node.thresholdHigh) {
    throw new Error(`Node ${node.id} requires thresholdLow < thresholdHigh.`);
  }
}

export function validateTrajectorySpecification(
  spec: PreregisteredTrajectorySpecification,
): void {
  if (!spec.nodes.length) throw new Error("Trajectory specification needs nodes.");
  const nodeIds = new Set<string>();
  for (const node of spec.nodes) {
    validateNodeSpec(node);
    if (nodeIds.has(node.id)) throw new Error(`Duplicate node id: ${node.id}`);
    nodeIds.add(node.id);
  }

  const edgeIds = new Set<string>();
  for (const edge of spec.edges) {
    if (edgeIds.has(edge.id)) throw new Error(`Duplicate edge id: ${edge.id}`);
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      throw new Error(`Edge ${edge.id} references an unknown node.`);
    }
    if (edge.lagMonthsMin < 0 || edge.lagMonthsMax < edge.lagMonthsMin) {
      throw new Error(`Edge ${edge.id} has invalid lag range.`);
    }
  }

  for (const edgeId of spec.primaryH2EdgeIds) {
    if (!edgeIds.has(edgeId)) throw new Error(`Primary H2 edge is unknown: ${edgeId}`);
  }
  if (spec.bottleneckRule.minimumSeparation <= 0) {
    throw new Error("Bottleneck minimum separation must be > 0.");
  }
}

export function selectBottleneckEdge(
  scores: readonly { edgeId: string; robustness: number }[],
  rule: BottleneckRule,
): string | null {
  if (!scores.length) return null;
  const sorted = [...scores].sort(
    (a, b) => a.robustness - b.robustness || a.edgeId.localeCompare(b.edgeId),
  );
  if (sorted.length > 1 && sorted[1].robustness - sorted[0].robustness < rule.minimumSeparation) {
    return null;
  }
  return sorted[0].edgeId;
}
