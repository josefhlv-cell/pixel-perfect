export type ForecastPoint = {
  origin: string;
  target: string;
  actual: number;
  forecast: number;
  baselineForecast: number;
};

export type ForecastMetrics = {
  count: number;
  mae: number;
  rmse: number;
  baselineMae: number;
  baselineRmse: number;
  maeSkill: number | null;
  rmseSkill: number | null;
  directionalAccuracy: number | null;
  baselineDirectionalAccuracy: number | null;
};

function mean(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function mae(rows: ForecastPoint[], field: "forecast" | "baselineForecast"): number {
  return mean(rows.map((row) => Math.abs(row.actual - row[field])));
}

function rmse(rows: ForecastPoint[], field: "forecast" | "baselineForecast"): number {
  return Math.sqrt(mean(rows.map((row) => (row.actual - row[field]) ** 2)));
}

function directionAccuracy(rows: ForecastPoint[], field: "forecast" | "baselineForecast"): number | null {
  const eligible = rows.filter((row) => row.actual !== 0 && row[field] !== 0);
  return eligible.length
    ? eligible.filter((row) => Math.sign(row.actual) === Math.sign(row[field])).length / eligible.length
    : null;
}

/**
 * Scores paired forecasts against a baseline on identical origins/targets.
 * Inputs must already be produced by an out-of-sample, point-in-time-safe
 * runner; this function does not itself certify vintage integrity.
 */
export function evaluateForecasts(rows: readonly ForecastPoint[]): ForecastMetrics {
  if (!rows.length) throw new Error("Cannot evaluate an empty forecast set.");
  const keys = new Set<string>();
  for (const row of rows) {
    if (!row.origin || !row.target) throw new Error("Every forecast requires origin and target identifiers.");
    for (const [key, value] of Object.entries(row)) {
      if (key === "origin" || key === "target") continue;
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`Forecast field ${key} must be finite.`);
      }
    }
    const pairKey = row.origin + "|" + row.target;
    if (keys.has(pairKey)) throw new Error(`Duplicate forecast origin/target pair: ${pairKey}`);
    keys.add(pairKey);
  }

  const values = [...rows];
  const modelMae = mae(values, "forecast");
  const modelRmse = rmse(values, "forecast");
  const baselineMae = mae(values, "baselineForecast");
  const baselineRmse = rmse(values, "baselineForecast");
  return {
    count: values.length,
    mae: modelMae,
    rmse: modelRmse,
    baselineMae,
    baselineRmse,
    maeSkill: baselineMae > 0 ? 1 - modelMae / baselineMae : null,
    rmseSkill: baselineRmse > 0 ? 1 - modelRmse / baselineRmse : null,
    directionalAccuracy: directionAccuracy(values, "forecast"),
    baselineDirectionalAccuracy: directionAccuracy(values, "baselineForecast"),
  };
}
