import { validateForecast, validateForecastOutcome, validateOutcomeTiming } from "./forecast-integrity";

export type HistoricalForecast = {
  checkpointAsOf: string;
  horizonDays: number;
  p10: number;
  p50: number;
  p90: number;
  probabilityPositive: number;
};

export type HistoricalOutcome = {
  realizedValue: number;
  /** Value known at the forecast origin; used as the naive random-walk prediction. */
  baselineValue: number;
  /** Timestamp when the realized value became observable, not when it was imported. */
  outcomeObservedAt: string;
};

export type HistoricalScore = {
  absoluteError: number;
  squaredError: number;
  naiveAbsoluteError: number;
  directionalHit: boolean;
  intervalCovered: boolean;
  brierScore: number;
  logScore: number;
  /** Descriptive absolute-movement shortfall, not a financial portfolio regret metric. */
  movementShortfall: number;
};

export function scoreHistoricalForecast(
  forecast: HistoricalForecast,
  outcome: HistoricalOutcome,
): HistoricalScore {
  const forecastValidation = validateForecast(forecast);
  if (!forecastValidation.valid) {
    throw new RangeError(`Invalid forecast: ${forecastValidation.issues.join("; ")}`);
  }

  const outcomeValidation = validateForecastOutcome(outcome);
  if (!outcomeValidation.valid) {
    throw new RangeError(`Invalid outcome: ${outcomeValidation.issues.join("; ")}`);
  }

  const timingValidation = validateOutcomeTiming(
    forecast.checkpointAsOf,
    forecast.horizonDays,
    outcome.outcomeObservedAt,
  );
  if (!timingValidation.valid) {
    throw new RangeError(`Invalid outcome timing: ${timingValidation.issues.join("; ")}`);
  }

  const actualChange = outcome.realizedValue - outcome.baselineValue;
  const predictedChange = forecast.p50 - outcome.baselineValue;
  const absoluteError = Math.abs(forecast.p50 - outcome.realizedValue);
  const squaredError = absoluteError ** 2;
  const naiveAbsoluteError = Math.abs(outcome.baselineValue - outcome.realizedValue);
  const predictedDirection = Math.sign(predictedChange);
  const actualDirection = Math.sign(actualChange);
  const directionalHit = predictedDirection !== 0 && predictedDirection === actualDirection;
  const intervalCovered = outcome.realizedValue >= forecast.p10 && outcome.realizedValue <= forecast.p90;
  const y = actualChange > 0 ? 1 : 0;
  const p = Math.min(1 - 1e-12, Math.max(1e-12, forecast.probabilityPositive));
  const brierScore = (p - y) ** 2;
  const logScore = -(y * Math.log(p) + (1 - y) * Math.log(1 - p));
  const movementShortfall = Math.max(0, Math.abs(actualChange) - Math.abs(predictedChange));

  return {
    absoluteError,
    squaredError,
    naiveAbsoluteError,
    directionalHit,
    intervalCovered,
    brierScore,
    logScore,
    movementShortfall,
  };
}

export function aggregateHistoricalScores(scores: HistoricalScore[]) {
  if (!scores.length) return null;
  const mean = (key: keyof HistoricalScore) =>
    scores.reduce((sum, score) => sum + Number(score[key]), 0) / scores.length;
  const mae = mean("absoluteError");
  const naiveMae = mean("naiveAbsoluteError");
  return {
    sampleCount: scores.length,
    mae,
    rmse: Math.sqrt(mean("squaredError")),
    naiveMae,
    /** Positive means the model beats a naive no-change forecast; null if baseline MAE is zero. */
    skillVsNaive: naiveMae === 0 ? null : 1 - mae / naiveMae,
    directionalAccuracy: mean("directionalHit"),
    intervalCoverage: mean("intervalCovered"),
    brier: mean("brierScore"),
    logLoss: mean("logScore"),
    movementShortfall: mean("movementShortfall"),
  };
}
