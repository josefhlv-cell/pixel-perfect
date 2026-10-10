export type ForecastCase = {
  actual: number;
  predicted: number;
  directionActual: -1 | 0 | 1;
  directionPredicted: -1 | 0 | 1;
  lower80?: number;
  upper80?: number;
  probabilityPositive?: number;
};

export type ForecastMetrics = {
  n: number;
  mae: number | null;
  rmse: number | null;
  directionalAccuracy: number | null;
  brierScore: number | null;
  interval80Coverage: number | null;
  interval80Count: number;
};

function mean(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

/** Deterministic, model-agnostic metrics for preregistered holdout folds. */
export function scoreForecasts(rows: readonly ForecastCase[]): ForecastMetrics {
  const valid = rows.filter((row) =>
    Number.isFinite(row.actual) &&
    Number.isFinite(row.predicted) &&
    [-1, 0, 1].includes(row.directionActual) &&
    [-1, 0, 1].includes(row.directionPredicted)
  );
  if (valid.length !== rows.length) throw new Error("Forecast cases contain invalid numeric values or directions.");

  const errors = valid.map((row) => row.predicted - row.actual);
  const intervalRows = valid.filter((row) =>
    Number.isFinite(row.lower80) &&
    Number.isFinite(row.upper80)
  );
  for (const row of intervalRows) {
    if ((row.lower80 as number) > (row.upper80 as number)) {
      throw new Error("Forecast interval lower bound exceeds upper bound.");
    }
  }
  const probabilityRows = valid.filter((row) => row.probabilityPositive != null);
  if (probabilityRows.some((row) => !Number.isFinite(row.probabilityPositive) || (row.probabilityPositive as number) < 0 || (row.probabilityPositive as number) > 1)) {
    throw new Error("Probability scores must be within [0, 1].");
  }

  return {
    n: valid.length,
    mae: mean(errors.map(Math.abs)),
    rmse: mean(errors.map((error) => error * error)) == null
      ? null
      : Math.sqrt(mean(errors.map((error) => error * error)) as number),
    directionalAccuracy: mean(valid.map((row) => Number(row.directionActual === row.directionPredicted))),
    brierScore: probabilityRows.length
      ? mean(probabilityRows.map((row) => ((row.probabilityPositive as number) - Number(row.directionActual > 0)) ** 2))
      : null,
    interval80Coverage: intervalRows.length
      ? mean(intervalRows.map((row) => Number((row.lower80 as number) <= row.actual && row.actual <= (row.upper80 as number))))
      : null,
    interval80Count: intervalRows.length,
  };
}

/** Persistence baseline: forecast the last observed level as the next level. */
export function naivePersistenceForecast(lastObserved: number): number {
  if (!Number.isFinite(lastObserved)) throw new Error("Last observed value must be finite.");
  return lastObserved;
}

/** Training-only mean baseline. Caller must pass training values only. */
export function trainingMeanForecast(trainingValues: readonly number[]): number {
  if (!trainingValues.length || trainingValues.some((value) => !Number.isFinite(value))) {
    throw new Error("Training mean requires at least one finite training value.");
  }
  return trainingValues.reduce((sum, value) => sum + value, 0) / trainingValues.length;
}

/** Training-only directional baseline, with exact zero mapped to neutral. */
export function trainingMeanDirection(trainingValues: readonly number[]): -1 | 0 | 1 {
  const meanValue = trainingMeanForecast(trainingValues);
  return meanValue > 0 ? 1 : meanValue < 0 ? -1 : 0;
}
