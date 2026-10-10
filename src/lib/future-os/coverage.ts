export type CoverageSnapshot = {
  adapterKey: string;
  geographyType: string;
  geographyKey: string;
  entityType: string;
  entityKey: string;
  firstObservedAt: string | null;
  lastObservedAt: string | null;
  lastAvailableAt: string | null;
  observationCount: number;
  missingRate: number;
  revisionRate: number;
  sourceReliability: number;
};

export function summarizeCoverage(
  adapterKey: string,
  rows: Array<{
    geographyType: string;
    geographyKey: string;
    entityType: string;
    entityKey: string;
    observedAt: string | null;
    availableAt: string;
    value: unknown;
    isRevision: boolean;
    sourceReliability: number;
  }>,
): CoverageSnapshot[] {
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = [row.geographyType,row.geographyKey,row.entityType,row.entityKey].join("|");
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  return [...groups.entries()].map(([key, group]) => {
    const [geographyType = "", geographyKey = "", entityType = "", entityKey = ""] = key.split("|");
    const ordered = [...group].sort((a,b) => +new Date(a.availableAt) - +new Date(b.availableAt));
    const missingRate = ordered.length
      ? ordered.filter((row) => row.value == null).length / ordered.length
      : 1;
    return {
      adapterKey,
      geographyType,
      geographyKey,
      entityType,
      entityKey,
      firstObservedAt: ordered.find((row) => row.observedAt)?.observedAt ?? null,
      lastObservedAt: ordered.at(-1)?.observedAt ?? null,
      lastAvailableAt: ordered.at(-1)?.availableAt ?? null,
      observationCount: ordered.length,
      missingRate,
      revisionRate: ordered.length ? ordered.filter((row) => row.isRevision).length / ordered.length : 0,
      sourceReliability: ordered.length ? ordered.reduce((s,row) => s + row.sourceReliability,0) / ordered.length : 0,
    };
  });
}
