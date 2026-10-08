export type MechanismEvidence = {
  evidenceStrength: number;
  predictiveStrength: number;
  causalIdentification: number;
  stability: number;
  regimeRobustness: number;
  dataQuality: number;
  sourceIndependence: number;
  replication: number;
  outOfSamplePerformance: number;
};

export type MechanismTrust = {
  score: number;
  status: "UNTESTED" | "CANDIDATE" | "SUPPORTED" | "ROBUST";
  weakestDimension: keyof MechanismEvidence;
  dimensions: MechanismEvidence;
};

export function evaluateMechanismTrust(input: MechanismEvidence): MechanismTrust {
  const dimensions = Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, Math.max(0, Math.min(1, value))]),
  ) as MechanismEvidence;

  const weights: Record<keyof MechanismEvidence, number> = {
    evidenceStrength: 0.10,
    predictiveStrength: 0.16,
    causalIdentification: 0.18,
    stability: 0.12,
    regimeRobustness: 0.10,
    dataQuality: 0.08,
    sourceIndependence: 0.08,
    replication: 0.08,
    outOfSamplePerformance: 0.10,
  };

  const score = (Object.keys(weights) as Array<keyof MechanismEvidence>)
    .reduce((sum, key) => sum + dimensions[key] * weights[key], 0);

  const weakestDimension = (Object.keys(dimensions) as Array<keyof MechanismEvidence>)
    .sort((a, b) => dimensions[a] - dimensions[b])[0];

  const status =
    score >= 0.82 && dimensions.causalIdentification >= 0.7 && dimensions.outOfSamplePerformance >= 0.75
      ? "ROBUST"
      : score >= 0.62 && dimensions.outOfSamplePerformance >= 0.6
        ? "SUPPORTED"
        : score >= 0.38
          ? "CANDIDATE"
          : "UNTESTED";

  return { score, status, weakestDimension, dimensions };
}
