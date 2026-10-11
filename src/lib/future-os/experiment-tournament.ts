export type ExperimentResult = {
  modelKey: string;
  horizonDays: number;
  sampleCount: number;
  mae: number;
  rmse: number;
  directionalAccuracy: number;
  intervalCoverage: number;
  brier: number;
  logLoss: number;
  regret: number;
  driftPenalty: number;
};

export function rankExperiments(results: ExperimentResult[]) {
  return [...results]
    .map((result) => {
      const score =
        result.mae * 0.2 +
        result.rmse * 0.15 +
        (1 - result.directionalAccuracy) * 0.15 +
        Math.abs(result.intervalCoverage - 0.9) * 0.1 +
        result.brier * 0.1 +
        result.logLoss * 0.1 +
        result.regret * 0.15 +
        result.driftPenalty * 0.05;
      return { ...result, tournamentLoss: score };
    })
    .sort((a, b) => a.tournamentLoss - b.tournamentLoss);
}

export function championFromExperiments(results: ExperimentResult[], minSamples = 10) {
  const eligible = rankExperiments(results).filter((result) => result.sampleCount >= minSamples);
  return eligible[0] ?? null;
}
