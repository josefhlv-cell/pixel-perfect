import { readNumericEvidenceValue } from "./numeric-value";
import { getEvidenceAvailableAt } from "./point-in-time";
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
  const usable = getEvidenceAvailableAt(evidence, asOf);
  const latest = new Map<string, EvidenceObservation>();
  for (const row of usable) {
    const key = row.entityType + ":" + row.entityKey;
    const current = latest.get(key);
    const period = row.effectiveFrom ?? row.observedAt ?? "";
    const currentPeriod = current ? (current.effectiveFrom ?? current.observedAt ?? "") : "";
    if (!current || period > currentPeriod) latest.set(key, row);
  }
  const values = latest;
  return edges.flatMap((edge) => {
    const parent = values.get(edge.parent);
    if (!parent) return [];
    const raw = readNumericEvidenceValue(parent.value);
    if (raw == null) return [];
    const direction = raw === 0 ? 0 : edge.expectedSign;
    const confidence = (edge.confidence ?? 0.5) * (edge.strength ?? 0.5) * parent.sourceReliability;
    return [
      {
        edgeKey: edge.edgeKey,
        parentEvidenceId: parent.id,
        parentValue: raw,
        child: edge.child,
        direction: direction as -1 | 0 | 1,
        lagMinDays: edge.lagMinDays,
        lagMaxDays: edge.lagMaxDays,
        confidence,
      },
    ];
  });
}
