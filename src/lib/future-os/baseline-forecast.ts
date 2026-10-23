import { scoreForecasts, type ForecastCase, type ForecastMetrics } from "./backtest/metrics";

export type TimeSeriesPoint = {
  period: string;
  value: number;
  availableAt: string;
};

export type ForecastMethod = "LAST_VALUE" | "DRIFT" | "ROLLING_MEAN";

export type BaselineResult = {
  method: ForecastMethod;
  origin: string;
  horizonSteps: number;
  prediction: number;
  trainingPoints: number;
};

/**
 * Transparent baselines for walk-forward comparison (ported from PR #2).
 * Points not yet published at origin (availableAt > origin) or whose period
 * lies after origin are dropped, so a later revision can never leak in.
 */
export function forecastBaseline(input: {
  history: readonly TimeSeriesPoint[];
  origin: string;
  horizonSteps: number;
  method: ForecastMethod;
  rollingWindow?: number;
}): BaselineResult {
  const originMs = parseDate(input.origin, "origin");
  if (!Number.isInteger(input.horizonSteps) || input.horizonSteps < 1) {
    throw new Error("horizonSteps must be a positive integer.");
  }
  const history = input.history
    .filter((p) => parseDate(p.availableAt, "availableAt") <= originMs)
    .filter((p) => parseDate(p.period, "period") <= originMs)
    .slice()
    .sort((a, b) => a.period.localeCompare(b.period));
  if (!history.length) throw new Error("Baseline requires at least one point available at origin.");
  if (history.some((p) => !Number.isFinite(p.value))) {
    throw new Error("Baseline history contains a non-finite value.");
  }
  const first = history[0]!;
  const last = history[history.length - 1]!;
  let prediction: number;
  if (input.method === "LAST_VALUE") {
    prediction = last.value;
  } else if (input.method === "DRIFT") {
    const perStep = history.length > 1 ? (last.value - first.value) / (history.length - 1) : 0;
    prediction = last.value + perStep * input.horizonSteps;
  } else {
    const window = input.rollingWindow ?? 4;
    if (!Number.isInteger(window) || window < 1)
      throw new Error("rollingWindow must be a positive integer.");
    const tail = history.slice(-window);
    prediction = tail.reduce((s, p) => s + p.value, 0) / tail.length;
  }
  return {
    method: input.method,
    origin: new Date(originMs).toISOString(),
    horizonSteps: input.horizonSteps,
    prediction,
    trainingPoints: history.length,
  };
}

/**
 * Rolling-origin backtest of one baseline over a series. Each origin is the
 * availableAt of a point; the realization is the value `horizonSteps` later.
 * Scored with the shared backtest metrics (one scoring implementation).
 */
export function backtestBaseline(
  series: readonly TimeSeriesPoint[],
  method: ForecastMethod,
  horizonSteps = 1,
  minTraining = 4,
): ForecastMetrics {
  const ordered = [...series].sort((a, b) => a.period.localeCompare(b.period));
  const cases: ForecastCase[] = [];
  for (let i = minTraining - 1; i + horizonSteps < ordered.length; i += 1) {
    const origin = ordered[i]!;
    const actual = ordered[i + horizonSteps]!.value;
    const { prediction } = forecastBaseline({
      history: ordered,
      origin: origin.availableAt,
      horizonSteps,
      method,
    });
    cases.push({
      actual,
      predicted: prediction,
      directionActual: sign(actual - origin.value),
      directionPredicted: sign(prediction - origin.value),
    });
  }
  return scoreForecasts(cases);
}

function sign(v: number): -1 | 0 | 1 {
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

function parseDate(value: string, field: string): number {
  const t = Date.parse(value);
  if (!Number.isFinite(t)) throw new Error(`Invalid ${field} date: ${value}`);
  return t;
}
