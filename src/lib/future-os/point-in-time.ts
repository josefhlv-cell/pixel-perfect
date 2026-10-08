import type { DataQuality, EvidenceFilters, EvidenceObservation } from "./types";

export function isAvailableAt(row: EvidenceObservation, asOf: Date | string): boolean {
  return new Date(row.availableAt).getTime() <= new Date(asOf).getTime();
}

export function assertNoFutureEvidence(rows: EvidenceObservation[], asOf: Date | string): void {
  const cutoff = new Date(asOf).getTime();
  const future = rows.find((row) => new Date(row.availableAt).getTime() > cutoff);
  if (future) {
    throw new Error(`Point-in-time violation: evidence ${future.id} is available at ${future.availableAt}, after cutoff ${new Date(asOf).toISOString()}`);
  }
}

export function getEvidenceAvailableAt(
  rows: EvidenceObservation[],
  asOf: Date | string,
  filters: EvidenceFilters = {},
): EvidenceObservation[] {
  const cutoff = new Date(asOf).getTime();
  const eligible = rows.filter((row) => {
    if (new Date(row.availableAt).getTime() > cutoff) return false;
    if (filters.sourceId && row.sourceId !== filters.sourceId) return false;
    if (filters.geographyType && row.geographyType !== filters.geographyType) return false;
    if (filters.geographyKey && row.geographyKey !== filters.geographyKey) return false;
    if (filters.entityType && row.entityType !== filters.entityType) return false;
    if (filters.entityKey && row.entityKey !== filters.entityKey) return false;
    if (filters.leadClass && row.leadClass !== filters.leadClass) return false;
    return true;
  });

  const latest = new Map<string, EvidenceObservation>();
  for (const row of eligible) {
    const key = `${row.sourceId}|${row.geographyType}|${row.geographyKey}|${row.entityType}|${row.entityKey}`;
    const current = latest.get(key);
    if (!current ||
      new Date(row.availableAt).getTime() > new Date(current.availableAt).getTime() ||
      (row.availableAt === current.availableAt && row.revision > current.revision)) {
      latest.set(key, row);
    }
  }
  return [...latest.values()].sort((a, b) => new Date(a.availableAt).getTime() - new Date(b.availableAt).getTime());
}

export function computeDataQuality(rows: EvidenceObservation[], requiredFields: string[] = []): DataQuality {
  if (rows.length === 0) {
    return {
      completeness: 0,
      provenanceCompleteness: 0,
      sourceReliability: 0,
      independence: 0,
      status: "DATA_STARVED",
      missingFields: requiredFields,
    };
  }

  const missingFields = requiredFields.filter((field) =>
    !rows.some((row) => row.metadata?.[field] != null || (row as unknown as Record<string, unknown>)[field] != null),
  );

  const provenanceComplete = rows.filter((row) =>
    Boolean(row.sourceId && row.sourceName && row.availableAt && row.retrievedAt && row.contentHash && row.independenceGroup),
  ).length / rows.length;

  const reliability = rows.reduce((sum, row) => sum + row.sourceReliability, 0) / rows.length;
  const groups = new Set(rows.map((row) => row.independenceGroup).filter(Boolean));
  const independence = Math.min(1, groups.size / Math.max(1, Math.min(5, rows.length)));
  const completeness = Math.max(0, 1 - missingFields.length / Math.max(1, requiredFields.length));

  const score = completeness * 0.4 + provenanceComplete * 0.25 + reliability * 0.25 + independence * 0.1;
  return {
    completeness,
    provenanceCompleteness: provenanceComplete,
    sourceReliability: reliability,
    independence,
    status: score >= 0.7 ? "READY" : score >= 0.4 ? "LIMITED" : "DATA_STARVED",
    missingFields,
  };
}
