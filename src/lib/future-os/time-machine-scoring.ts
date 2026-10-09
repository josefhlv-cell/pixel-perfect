import { validateForecast, validateForecastOutcome } from "./forecast-integrity";

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
  baselineValue: number;
};

export type HistoricalScore = {
  absoluteError: number;
  squaredError: number;
  directionalHit: boolean;
  intervalCovered: boolean;
  brierScore: number;
  logScore: number;
  regret: number;
};

/** Score one forecast against an observed outcome. Invalid records fail closed. */
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

  const actualChange = outcome.realizedValue - outcome.baselineValue;
  const predictedChange = forecast.p50 - outcome.baselineValue;
  const error = predictedChange - actualChange;
  const absoluteError = Math.abs(error);
  const squaredError = error ** 2;
  const predictedDirection = Math.sign(predictedChange);
  const actualDirection = Math.sign(actualChange);
  // A zero-change forecast is not counted as a directional hit.
  const directionalHit = predictedDirection !== 0 && predictedDirection === actualDirection;
  const intervalCovered = outcome.realizedValue >= forecast.p10 && outcome.realizedValue <= forecast.p90;
  const y = actualChange > 0 ? 1 : 0;
  // Avoid infinite log loss at exact 0/1 while retaining a finite score.
  const p = Math.min(1 - 1e-12, Math.max(1e-12, forecast.probabilityPositive));
  const brierScore = (p - y) ** 2;
  const logScore = -(y * Math.log(p) + (1 - y) * Math.log(1 - p));
  const regret = Math.max(0, Math.abs(actualChange) - Math.abs(predictedChange));
  return { absoluteError, squaredError, directionalHit, intervalCovered, brierScore, logScore, regret };
}

export function aggregateHistoricalScores(scores: HistoricalScore[]) {
  if (!scores.length) return null;
  const mean = (key: keyof HistoricalScore) =>
    scores.reduce((sum, score) => sum + Number(score[key]), 0) / scores.length;
  return {
    sampleCount: scores.length,
    mae: mean("absoluteError"),
    rmse: Math.sqrt(mean("squaredError")),
    directionalAccuracy: mean("directionalHit"),
    intervalCoverage: mean("intervalCovered"),
    brier: mean("brierScore"),
    logLoss: mean("logScore"),
    regret: mean("regret"),
  };
}
