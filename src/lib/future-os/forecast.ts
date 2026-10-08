import type { EvidenceObservation } from "./types";
import { assertNoFutureEvidence } from "./point-in-time";

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
  if (input.p10 > input.p50 || input.p50 > input.p90) {
    throw new Error("Forecast quantiles must satisfy p10 <= p50 <= p90.");
  }
  if (input.probabilityPositive < 0 || input.probabilityPositive > 1) {
    throw new Error("Forecast probability must be within [0,1].");
  }
  assertNoFutureEvidence(input.evidence, input.dataCutoff);
}

export function scoreForecast(
  input: ForecastInput,
  realized: number,
): ForecastScore {
  validateForecastInput(input);
  const insideInterval = realized >= input.p10 && realized <= input.p90;
  const directionalHit = input.p50 >= 0 ? realized >= 0 : realized < 0;
  const probability = Math.min(1 - Number.EPSILON, Math.max(Number.EPSILON, input.probabilityPositive));
  const outcome = realized >= 0 ? 1 : 0;
  return {
    insideInterval,
    absoluteError: Math.abs(input.p50 - realized),
    directionalHit,
    brierScore: (probability - outcome) ** 2,
    logScore: outcome === 1 ? Math.log(probability) : Math.log(1 - probability),
  };
}
