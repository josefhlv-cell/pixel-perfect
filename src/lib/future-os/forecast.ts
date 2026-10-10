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
  if (![input.p10, input.p50, input.p90, input.probabilityPositive].every(Number.isFinite)) {
    throw new Error("Forecast quantiles and probability must be finite.");
  }
  if (input.p10 > input.p50 || input.p50 > input.p90) {
    throw new Error("Forecast quantiles must satisfy p10 <= p50 <= p90.");
  }
  if (input.probabilityPositive < 0 || input.probabilityPositive > 1) {
    throw new Error("Forecast probability must be within [0,1].");
  }
  assertNoFutureEvidence(input.evidence, input.dataCutoff);
}

export function calibrateForecastIntervals(
  input: ForecastInput,
  issuedAt: string,
  history: IntervalCalibrationObservation[],
): ForecastInput & { calibration: IntervalCalibrationResult } {
  validateForecastInput(input);
  if (!Number.isFinite(Date.parse(issuedAt)) || Date.parse(issuedAt) < Date.parse(input.dataCutoff)) {
    throw new Error("Forecast issue time must be valid and cannot precede the data cutoff.");
  }
  const calibration = calibratePredictionInterval({
    issuedAt,
    p10: input.p10,
    p50: input.p50,
    p90: input.p90,
    history,
  });
  return { ...input, p10: calibration.p10, p50: calibration.p50, p90: calibration.p90, calibration };
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
  const directionalHit = Math.sign(predictedChange) !== 0 && Math.sign(predictedChange) === Math.sign(actualChange);
  const probability = Math.min(1 - 1e-12, Math.max(1e-12, input.probabilityPositive));
  const outcome = actualChange > 0 ? 1 : 0;
  return {
    insideInterval,
    absoluteError: Math.abs(input.p50 - realized),
    directionalHit,
    brierScore: (probability - outcome) ** 2,
    logScore: outcome === 1 ? Math.log(probability) : Math.log(1 - probability),
  };
}
