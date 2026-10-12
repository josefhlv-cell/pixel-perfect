import type { EvidenceObservation } from "./types";
import { parseEvidenceNumericValue } from "./signal-discovery";
import { getEvidenceAvailableAt } from "./point-in-time";

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

function periodTimestamp(row: EvidenceObservation): number {
  const period = row.effectiveFrom ?? row.observedAt;
  return period ? new Date(period).getTime() : Number.NEGATIVE_INFINITY;
}

export function propagateCausalSignal(
  edges: CausalEdge[],
  evidence: EvidenceObservation[],
  asOf: Date | string,
) {
  // Fail closed for invalid cutoffs and exclude evidence with invalid/future availability.
  const usable = getEvidenceAvailableAt(evidence, asOf);
  const grouped = new Map<string, EvidenceObservation[]>();
  for (const row of usable) {
    const key = row.entityType + ":" + row.entityKey;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }

  return edges.flatMap((edge) => {
    const candidates = grouped.get(edge.parent) ?? [];
    if (candidates.length === 0) return [];

    // An edge has no geography/source selector. Refuse to silently mix distinct
    // geographic series; callers must disambiguate them before causal propagation.
    const geographies = new Set(
      candidates.map((row) => row.geographyType + ":" + row.geographyKey),
    );
    if (geographies.size !== 1) return [];

    // Select the newest effective period, then latest available revision for that period.
    const sorted = [...candidates].sort((a, b) => {
      const periodDiff = periodTimestamp(b) - periodTimestamp(a);
      if (Number.isFinite(periodDiff) && periodDiff !== 0) return periodDiff;
      const availableDiff = new Date(b.availableAt).getTime() - new Date(a.availableAt).getTime();
      if (availableDiff !== 0) return availableDiff;
      return b.revision - a.revision;
    });
    const parent = sorted[0];
    if (!parent) return [];
    const raw = parseEvidenceNumericValue(parent.value);
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
