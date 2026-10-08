export type EvidenceCluster = {
  evidenceId: string;
  independenceGroup: string;
  reliability: number;
};

export type IndependenceSummary = {
  independentGroups: number;
  effectiveEvidence: number;
  concentration: number;
  confidenceMultiplier: number;
};

export function summarizeSourceIndependence(rows: EvidenceCluster[]): IndependenceSummary {
  if (!rows.length) return { independentGroups: 0, effectiveEvidence: 0, concentration: 1, confidenceMultiplier: 0 };
  const groups = new Map<string, number>();
  for (const row of rows) {
    groups.set(row.independenceGroup, (groups.get(row.independenceGroup) ?? 0) + Math.max(0, row.reliability));
  }
  const weights = [...groups.values()].sort((a,b)=>b-a);
  const total = weights.reduce((s,x)=>s+x,0);
  const concentration = total ? weights[0] / total : 1;
  const effectiveEvidence = total > 0
    ? (total * total) / weights.reduce((s,x)=>s+x*x,0)
    : 0;
  const confidenceMultiplier = Math.min(1, effectiveEvidence / Math.max(1, rows.length));
  return {
    independentGroups: groups.size,
    effectiveEvidence,
    concentration,
    confidenceMultiplier,
  };
}
