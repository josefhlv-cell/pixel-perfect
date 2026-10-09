/**
 * Guardrails for forecast evaluation.
 *
 * These checks validate structure, not predictive quality. A structurally valid
 * forecast must still be evaluated with chronological, leakage-free backtests.
 */
export type ForecastForValidation = {
  checkpointAsOf: string;
  horizonDays: number;
  p10: number;
  p50: number;
  p90: number;
  probabilityPositive: number;
};

export type ForecastValidation = {
  valid: boolean;
  issues: string[];
};

export function validateForecast(forecast: ForecastForValidation): ForecastValidation {
  const issues: string[] = [];
  const checkpoint = Date.parse(forecast.checkpointAsOf);

  if (!Number.isFinite(checkpoint)) issues.push("checkpointAsOf must be a valid date-time");
  if (!Number.isFinite(forecast.horizonDays) || forecast.horizonDays <= 0) {
    issues.push("horizonDays must be a finite positive number");
  }

  for (const key of ["p10", "p50", "p90"] as const) {
    if (!Number.isFinite(forecast[key])) issues.push(`${key} must be finite`);
  }

  if ([forecast.p10, forecast.p50, forecast.p90].every(Number.isFinite)) {
    if (forecast.p10 > forecast.p50 || forecast.p50 > forecast.p90) {
      issues.push("quantiles must be ordered p10 <= p50 <= p90");
    }
  }

  if (
    !Number.isFinite(forecast.probabilityPositive) ||
    forecast.probabilityPositive < 0 ||
    forecast.probabilityPositive > 1
  ) {
    issues.push("probabilityPositive must be between 0 and 1");
  }

  return { valid: issues.length === 0, issues };
}

export function validateForecastOutcome(outcome: {
  realizedValue: number;
  baselineValue: number;
}): ForecastValidation {
  const issues: string[] = [];
  if (!Number.isFinite(outcome.realizedValue)) issues.push("realizedValue must be finite");
  if (!Number.isFinite(outcome.baselineValue)) issues.push("baselineValue must be finite");
  return { valid: issues.length === 0, issues };
}


/**
 * Ensure an outcome is not scored before the forecast horizon has elapsed.
 * Callers must pass the timestamp when the outcome became observable, not a
 * later database-import timestamp. This is a guardrail, not proof that all
 * input features were historically available.
 */
export function validateOutcomeTiming(
  checkpointAsOf: string,
  horizonDays: number,
  outcomeObservedAt: string,
): ForecastValidation {
  const issues: string[] = [];
  const checkpoint = Date.parse(checkpointAsOf);
  const observed = Date.parse(outcomeObservedAt);

  if (!Number.isFinite(checkpoint)) issues.push("checkpointAsOf must be a valid date-time");
  if (!Number.isFinite(horizonDays) || horizonDays <= 0) {
    issues.push("horizonDays must be a finite positive number");
  }
  if (!Number.isFinite(observed)) issues.push("outcomeObservedAt must be a valid date-time");

  if (issues.length === 0 && observed < checkpoint + horizonDays * 24 * 60 * 60 * 1000) {
    issues.push("outcome was observed before the forecast horizon matured");
  }

  return { valid: issues.length === 0, issues };
}
