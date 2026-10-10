/**
 * Rolling split-conformal interval calibration for time-ordered forecasts.
 *
 * Uses only outcomes observable before the current forecast issuance time.
 * The finite-sample conformal rank is exact under exchangeability; time-series
 * dependence and regime changes can weaken that guarantee, so callers must
 * monitor realized coverage and should use an explicitly chronological window.
 */
export type IntervalCalibrationObservation = {
  forecastIssuedAt: string;
  outcomeObservedAt: string;
  actual: number;
  p10: number;
  p90: number;
};

export type IntervalCalibrationInput = {
  issuedAt: string;
  p10: number;
  p50: number;
  p90: number;
  history: IntervalCalibrationObservation[];
  alpha?: number;
  windowSize?: number;
  minSamples?: number;
};

export type IntervalCalibrationResult = {
  status: "CALIBRATED" | "INSUFFICIENT_DATA";
  method: "ROLLING_SPLIT_CONFORMAL";
  p10: number;
  p50: number;
  p90: number;
  expansion: number;
  alpha: number;
  sampleCount: number;
  excludedFutureOutcomes: number;
  calibrationCutoff: string;
};

const DEFAULT_ALPHA = 0.1;
const DEFAULT_WINDOW_SIZE = 120;
const DEFAULT_MIN_SAMPLES = 20;

function validObservation(row: IntervalCalibrationObservation): boolean {
  if (!row || typeof row !== "object") return false;
  const forecastIssuedAt = Date.parse(row.forecastIssuedAt);
  const outcomeObservedAt = Date.parse(row.outcomeObservedAt);

  return (
    Number.isFinite(forecastIssuedAt) &&
    Number.isFinite(outcomeObservedAt) &&
    forecastIssuedAt < outcomeObservedAt &&
    Number.isFinite(row.actual) &&
    Number.isFinite(row.p10) &&
    Number.isFinite(row.p90) &&
    row.p10 <= row.p90
  );
}

function validateInput(input: IntervalCalibrationInput): {
  issuedAtMs: number;
  alpha: number;
  windowSize: number;
  minSamples: number;
} {
  const issuedAtMs = Date.parse(input.issuedAt);
  if (!Number.isFinite(issuedAtMs)) {
    throw new RangeError("issuedAt must be a valid date-time");
  }
  for (const [name, value] of [
    ["p10", input.p10],
    ["p50", input.p50],
    ["p90", input.p90],
  ] as const) {
    if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
  }
  if (input.p10 > input.p50 || input.p50 > input.p90) {
    throw new RangeError("quantiles must be ordered p10 <= p50 <= p90");
  }

  const alpha = input.alpha ?? DEFAULT_ALPHA;
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha >= 1) {
    throw new RangeError("alpha must be strictly between 0 and 1");
  }
  const windowSize = input.windowSize ?? DEFAULT_WINDOW_SIZE;
  if (!Number.isInteger(windowSize) || windowSize < 1) {
    throw new RangeError("windowSize must be a positive integer");
  }
  const minSamples = input.minSamples ?? DEFAULT_MIN_SAMPLES;
  if (!Number.isInteger(minSamples) || minSamples < 1) {
    throw new RangeError("minSamples must be a positive integer");
  }

  return { issuedAtMs, alpha, windowSize, minSamples };
}

export function calibratePredictionInterval(
  input: IntervalCalibrationInput,
): IntervalCalibrationResult {
  const { issuedAtMs, alpha, windowSize, minSamples } = validateInput(input);
  let excludedFutureOutcomes = 0;

  const eligible = input.history
    .filter((row) => {
      if (!validObservation(row)) return false;
      const observedAt = Date.parse(row.outcomeObservedAt);
      if (observedAt > issuedAtMs) {
        excludedFutureOutcomes += 1;
        return false;
      }
      return true;
    })
    .slice()
    .sort((a, b) => Date.parse(a.outcomeObservedAt) - Date.parse(b.outcomeObservedAt))
    .slice(-windowSize);

  const base = {
    method: "ROLLING_SPLIT_CONFORMAL" as const,
    alpha,
    sampleCount: eligible.length,
    excludedFutureOutcomes,
    calibrationCutoff: new Date(issuedAtMs).toISOString(),
  };

  const insufficient = (): IntervalCalibrationResult => ({
    ...base,
    status: "INSUFFICIENT_DATA",
    p10: input.p10,
    p50: input.p50,
    p90: input.p90,
    expansion: 0,
  });

  if (eligible.length < minSamples) return insufficient();

  // Nonconformity score = distance outside the historical forecast interval.
  const scores = eligible
    .map((row) => Math.max(0, row.p10 - row.actual, row.actual - row.p90))
    .sort((a, b) => a - b);

  // Finite-sample conformal order statistic. If its rank exceeds n, available
  // history cannot support the requested coverage without an infinite interval.
  const rank = Math.ceil((scores.length + 1) * (1 - alpha));
  if (rank < 1 || rank > scores.length) return insufficient();

  const expansion = scores[rank - 1]!;
  return {
    ...base,
    status: "CALIBRATED",
    p10: input.p10 - expansion,
    p50: input.p50,
    p90: input.p90 + expansion,
    expansion,
  };
}
