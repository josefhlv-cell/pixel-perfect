export type ScenarioScoreRow = {
  scenarioId: string;
  probability: number;
  stressScore: number;
  information: number;
  realized: boolean;
};

export type RankingMetrics = {
  brier: number;
  directionalAccuracy: number;
  selectedScenarioRate: number;
};

function assertProbability(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be in [0,1].`);
  }
}

export function scoreScenarioRanking(rows: readonly ScenarioScoreRow[]): RankingMetrics {
  if (!rows.length) throw new Error("Cannot score an empty scenario ranking.");

  rows.forEach((row) => {
    assertProbability(row.probability, "probability");
    assertProbability(row.stressScore, "stressScore");
    assertProbability(row.information, "information");
  });

  const brier =
    rows.reduce((sum, row) => sum + (row.probability - (row.realized ? 1 : 0)) ** 2, 0) /
    rows.length;

  const selected = rows.reduce((best, row) => {
    const score = row.probability * row.stressScore * row.information;
    const bestScore = best.probability * best.stressScore * best.information;
    return score > bestScore ? row : best;
  }, rows[0]);

  return {
    brier,
    directionalAccuracy: selected.realized ? 1 : 0,
    selectedScenarioRate: 1,
  };
}

export function combinedScenarioScore(
  probability: number,
  stressScore: number,
  information: number,
  alpha = 1,
  beta = 1,
): number {
  assertProbability(probability, "probability");
  assertProbability(stressScore, "stressScore");
  assertProbability(information, "information");
  if (alpha <= 0 || beta <= 0) throw new Error("alpha and beta must be positive.");
  return probability ** alpha * stressScore ** beta * information;
}
