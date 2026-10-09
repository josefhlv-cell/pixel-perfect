export type ForecastProvenance = {
  forecastId: string;
  asOf: string;
  horizonDays: number;
  worldStateId?: string;
  evidenceIds: string[];
  modelId: string;
  modelVersion: string;
  parameterHash: string;
  hypothesisIds: string[];
  regime?: string;
  sourceCoverage?: number;
};

export function validateForecastProvenance(p: ForecastProvenance): string[] {
  const errors: string[] = [];
  if (!p.forecastId) errors.push("missing forecastId");
  if (!p.asOf) errors.push("missing asOf");
  if (!Number.isFinite(p.horizonDays) || p.horizonDays <= 0) errors.push("invalid horizonDays");
  if (!p.evidenceIds.length) errors.push("missing evidenceIds");
  if (!p.modelId || !p.modelVersion) errors.push("missing model identity");
  if (!p.parameterHash) errors.push("missing parameterHash");
  if (!p.hypothesisIds.length) errors.push("missing hypothesisIds");
  return errors;
}

export function provenanceHash(p: ForecastProvenance): string {
  return [
    p.forecastId,
    p.asOf,
    p.horizonDays,
    p.worldStateId ?? "",
    [...p.evidenceIds].sort().join(","),
    p.modelId,
    p.modelVersion,
    p.parameterHash,
    [...p.hypothesisIds].sort().join(","),
    p.regime ?? "",
  ].join("|");
}
