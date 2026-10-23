import type { EvidenceObservation } from "./types";
import { assertNoFutureEvidence } from "./point-in-time";
import {
  calibratePredictionInterval,
  type IntervalCalibrationObservation,
  type IntervalCalibrationResult,
} from "./temporal-calibration";

export type ForecastInput = {
  dataCutoff: string;
  evidence: EvidenceObservation[];
  p10: number;
  p50: number;
  p90: number;
  probabilityPositive: number;
  modelVersion: string;
  baselineVersion: string;
};

export type ForecastScore = {
  insideInterval: boolean;
  absoluteError: number;
  directionalHit: boolean;
  brierScore: number;
  logScore: number;
};

export function validateForecastInput(input: ForecastInput): void {
  // NaN/Infinity silently pass ordering comparisons, so reject them explicitly.
  if (![input.p10, input.p50, input.p90].every(Number.isFinite)) {
    throw new Error("Forecast quantiles must be finite numbers.");
  }
  if (input.p10 > input.p50 || input.p50 > input.p90) {
    throw new Error("Forecast quantiles must satisfy p10 <= p50 <= p90.");
  }
  if (
    !Number.isFinite(input.probabilityPositive) ||
    input.probabilityPositive < 0 ||
    input.probabilityPositive > 1
  ) {
    throw new Error("Forecast probability must be a finite number within [0,1].");
  }
  assertNoFutureEvidence(input.evidence, input.dataCutoff);
}

export function calibrateForecastIntervals(
  input: ForecastInput,
  issuedAt: string,
  history: IntervalCalibrationObservation[],
): ForecastInput & { calibration: IntervalCalibrationResult } {
  validateForecastInput(input);
  const issued = Date.parse(issuedAt);
  const cutoff = Date.parse(input.dataCutoff);
  if (!Number.isFinite(issued) || !Number.isFinite(cutoff) || issued < cutoff) {
    throw new Error("Forecast issue time must be valid and cannot precede the data cutoff.");
  }
  const calibration = calibratePredictionInterval({
    issuedAt,
    p10: input.p10,
    p50: input.p50,
    p90: input.p90,
    history,
  });
  return {
    ...input,
    p10: calibration.p10,
    p50: calibration.p50,
    p90: calibration.p90,
    calibration,
  };
}

export function scoreForecast(
  input: ForecastInput,
  realized: number,
  baselineValue = 0,
): ForecastScore {
  validateForecastInput(input);
  if (![realized, baselineValue].every(Number.isFinite)) {
    throw new Error("Realized and baseline values must be finite.");
  }
  const insideInterval = realized >= input.p10 && realized <= input.p90;
  const predictedChange = input.p50 - baselineValue;
  const actualChange = realized - baselineValue;
  const predictedDirection = Math.sign(predictedChange);
  const directionalHit = predictedDirection !== 0 && predictedDirection === Math.sign(actualChange);
  const probability = Math.min(
    1 - Number.EPSILON,
    Math.max(Number.EPSILON, input.probabilityPositive),
  );
  const outcome = actualChange > 0 ? 1 : 0;
  return {
    insideInterval,
    absoluteError: Math.abs(input.p50 - realized),
    directionalHit,
    brierScore: (probability - outcome) ** 2,
    logScore: outcome === 1 ? Math.log(probability) : Math.log(1 - probability),
  };
}
