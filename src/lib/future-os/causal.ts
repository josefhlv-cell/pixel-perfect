import type { EvidenceObservation } from "./types";

export type CausalEdge = {
  edgeKey: string;
  parent: string;
  child: string;
  expectedSign: -1 | 0 | 1;
  lagMinDays: number;
  lagMaxDays: number;
  strength: number | null;
  confidence: number | null;
  modelVersion: string;
};

export function propagateCausalSignal(
  edges: CausalEdge[],
  evidence: EvidenceObservation[],
  asOf: Date | string,
) {
  const cutoff = new Date(asOf).getTime();
  const usable = evidence.filter((row) => new Date(row.availableAt).getTime() <= cutoff);
  const values = new Map(usable.map((row) => [row.entityType + ":" + row.entityKey, row]));
  return edges.flatMap((edge) => {
    const parent = values.get(edge.parent);
    if (!parent) return [];
    const raw = typeof parent.value === "number" ? parent.value : null;
    if (raw == null) return [];
    const direction = raw === 0 ? 0 : edge.expectedSign;
    const confidence = (edge.confidence ?? 0.5) * (edge.strength ?? 0.5) * parent.sourceReliability;
    return [{
      edgeKey: edge.edgeKey,
      parentEvidenceId: parent.id,
      parentValue: raw,
      child: edge.child,
      direction: direction as -1 | 0 | 1,
      lagMinDays: edge.lagMinDays,
      lagMaxDays: edge.lagMaxDays,
      confidence,
    }];
  });
}
