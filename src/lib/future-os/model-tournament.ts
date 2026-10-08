export type ModelEvaluation = {
  modelId: string;
  mae: number | null;
  rmse: number | null;
  directionalAccuracy: number | null;
  intervalCoverage: number | null;
  brierScore: number | null;
  decisionUtility: number | null;
  regret: number | null;
  calibrationError: number | null;
  driftPenalty: number | null;
  robustnessScore: number | null;
  sampleCount: number;
};

export function tournamentScore(e: ModelEvaluation): number | null {
  if (e.sampleCount < 10) return null;
  if (e.mae == null || e.rmse == null || e.directionalAccuracy == null || e.intervalCoverage == null || e.brierScore == null || e.robustnessScore == null) return null;\n  const accuracy = 1 / (1 + Math.max(0, e.mae));
  const rmse = 1 / (1 + Math.max(0, e.rmse));
  const direction = e.directionalAccuracy;
  const coverage = 1 - Math.abs(e.intervalCoverage - 0.9);
  const brier = 1 - Math.min(1, Math.max(0, e.brierScore));
  const utility = e.decisionUtility == null ? 0 : 1 / (1 + Math.max(0, -e.decisionUtility));
  const regretPenalty = e.regret == null ? 0 : Math.min(1, Math.max(0, e.regret));
  const calibrationPenalty = e.calibrationError == null ? 0 : Math.min(1, Math.max(0, e.calibrationError));
  const driftPenalty = e.driftPenalty == null ? 0 : Math.min(1, Math.max(0, e.driftPenalty));
  const robustness = e.robustnessScore;

  return (
    accuracy * 0.18 +
    rmse * 0.12 +
    direction * 0.16 +
    coverage * 0.12 +
    brier * 0.10 +
    utility * 0.12 +
    robustness * 0.12 -
    regretPenalty * 0.03 -
    calibrationPenalty * 0.025 -
    driftPenalty * 0.025
  );
}

export function selectChampion(
  evaluations: ModelEvaluation[],
): { modelId: string; score: number } | null {
  const ranked = evaluations
    .map((evaluation) => ({ modelId: evaluation.modelId, score: tournamentScore(evaluation) }))
    .filter((item): item is { modelId: string; score: number } => item.score != null)
    .sort((a, b) => b.score - a.score);

  return ranked[0] ?? null;
}
