export type TimeSeriesPoint = {
  period: string;
  value: number;
  availableAt: string;
};

export type ForecastMethod = "LAST_VALUE" | "DRIFT" | "ROLLING_MEAN";

export type ForecastResult = {
  method: ForecastMethod;
  origin: string;
  horizonSteps: number;
  prediction: number;
  trainingPoints: number;
};

/**
 * Transparent baselines for a fair walk-forward comparison.
 * Input points must already be filtered to values available at origin.
 * This module never fetches realizations and never estimates parameters from
 * the holdout segment.
 */
export function forecastBaseline(input: {
  history: readonly TimeSeriesPoint[];
  origin: string;
  horizonSteps: number;
  method: ForecastMethod;
  rollingWindow?: number;
}): ForecastResult {
  const originMs = parseDate(input.origin, "origin");
  if (!Number.isInteger(input.horizonSteps) || input.horizonSteps < 1) {
    throw new Error("horizonSteps must be a positive integer.");
  }

  const history = input.history
    .filter((point) => parseDate(point.availableAt, "availableAt") <= originMs)
    .filter((point) => parseDate(point.period, "period") <= originMs)
    .slice()
    .sort((a, b) => a.period.localeCompare(b.period));

  if (!history.length) throw new Error("Baseline requires at least one point available at origin.");
  for (const point of history) {
    if (!Number.isFinite(point.value)) throw new Error("Baseline history contains a non-finite value.");
  }

  let prediction: number;
  if (input.method === "LAST_VALUE") {
    prediction = history[history.length - 1].value;
  } else if (input.method === "DRIFT") {
    const first = history[0];
    const last = history[history.length - 1];
    const perStep = history.length > 1 ? (last.value - first.value) / (history.length - 1) : 0;
    prediction = last.value + perStep * input.horizonSteps;
  } else {
    const window = input.rollingWindow ?? 4;
    if (!Number.isInteger(window) || window < 1) throw new Error("rollingWindow must be a positive integer.");
    const tail = history.slice(-window);
    prediction = tail.reduce((sum, point) => sum + point.value, 0) / tail.length;
  }

  return {
    method: input.method,
    origin: new Date(originMs).toISOString(),
    horizonSteps: input.horizonSteps,
    prediction,
    trainingPoints: history.length,
  };
}

export type ForecastScore = {
  count: number;
  mae: number;
  rmse: number;
  directionalAccuracy: number;
};

export type ForecastPair = {
  predicted: number;
  actual: number;
  previousActual: number;
};

export function scoreForecasts(pairs: readonly ForecastPair[]): ForecastScore {
  if (!pairs.length) throw new Error("At least one forecast/realization pair is required.");
  for (const pair of pairs) {
    if (![pair.predicted, pair.actual, pair.previousActual].every(Number.isFinite)) {
      throw new Error("Forecast score contains a non-finite value.");
    }
  }
  const absolute = pairs.map((pair) => Math.abs(pair.predicted - pair.actual));
  const squared = pairs.map((pair) => (pair.predicted - pair.actual) ** 2);
  const directionCorrect = pairs.filter((pair) => {
    const predictedDirection = Math.sign(pair.predicted - pair.previousActual);
    const actualDirection = Math.sign(pair.actual - pair.previousActual);
    return predictedDirection === actualDirection;
  }).length;
  return {
    count: pairs.length,
    mae: absolute.reduce((sum, value) => sum + value, 0) / pairs.length,
    rmse: Math.sqrt(squared.reduce((sum, value) => sum + value, 0) / pairs.length),
    directionalAccuracy: directionCorrect / pairs.length,
  };
}

function parseDate(value: string, field: string): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(`Invalid ${field} date: ${value}`);
  return timestamp;
}
