export type BaselineMethod = "NAIVE_LAST" | "MEAN_DRIFT" | "LINEAR_TREND";

export type BaselineForecast = {
  method: BaselineMethod;
  originIndex: number;
  horizon: number;
  point: number;
  predictedChange: number;
  residualScale: number;
  lower80: number;
  upper80: number;
  probabilityIncrease: number;
};

export type BaselineCase = {
  originIndex: number;
  horizon: number;
  actual: number;
  forecasts: readonly BaselineForecast[];
};

/**
 * Transparent baselines. The caller must pass only observations available at
 * the forecast origin; future values are deliberately not accepted by this API.
 * Interval scale is estimated from in-sample one-step residuals only.
 */
export function forecastBaselines(
  training: readonly number[],
  originIndex: number,
  horizon = 1,
): BaselineForecast[] {
  if (training.length < 3) throw new Error("At least three training observations are required.");
  if (!training.every(Number.isFinite)) throw new Error("Training series contains non-finite values.");
  if (!Number.isInteger(horizon) || horizon < 1) throw new Error("Horizon must be a positive integer.");
  const last = training[training.length - 1];
  const changes = training.slice(1).map((value, i) => value - training[i]);
  const meanChange = changes.reduce((sum, value) => sum + value, 0) / changes.length;
  const meanAbsDeviation = changes.reduce((sum, value) => sum + Math.abs(value - meanChange), 0) / changes.length;
  const residualScale = Math.max(meanAbsDeviation * 1.2533, 1e-9);

  const n = training.length;
  const xMean = (n - 1) / 2;
  const yMean = training.reduce((sum, value) => sum + value, 0) / n;
  let covariance = 0;
  let varianceX = 0;
  for (let i = 0; i < n; i++) {
    covariance += (i - xMean) * (training[i] - yMean);
    varianceX += (i - xMean) ** 2;
  }
  const slope = varianceX ? covariance / varianceX : 0;
  const trendPoint = yMean + slope * ((n - 1 + horizon) - xMean);

  const candidates: Array<{ method: BaselineMethod; point: number }> = [
    { method: "NAIVE_LAST", point: last },
    { method: "MEAN_DRIFT", point: last + meanChange * horizon },
    { method: "LINEAR_TREND", point: trendPoint },
  ];

  return candidates.map(({ method, point }) => {
    const predictedChange = point - last;
    const scale = residualScale * Math.sqrt(horizon);
    // A deliberately conservative normal approximation; evaluate calibration
    // on held-out data rather than treating this interval as guaranteed.
    const z80 = 1.2815515655446004;
    const probabilityIncrease = clampProbability(0.5 + 0.5 * erfApprox(predictedChange / (scale * Math.SQRT2)));
    return {
      method,
      originIndex,
      horizon,
      point,
      predictedChange,
      residualScale: scale,
      lower80: point - z80 * scale,
      upper80: point + z80 * scale,
      probabilityIncrease,
    };
  });
}

export function buildRollingOriginBaselineCases(
  series: readonly number[],
  horizon: number,
  minimumTraining = 8,
): BaselineCase[] {
  if (!Number.isInteger(horizon) || horizon < 1) throw new Error("Horizon must be a positive integer.");
  if (!Number.isInteger(minimumTraining) || minimumTraining < 3) throw new Error("Minimum training must be at least three.");
  const cases: BaselineCase[] = [];
  for (let origin = minimumTraining - 1; origin + horizon < series.length; origin++) {
    const training = series.slice(0, origin + 1);
    const actual = series[origin + horizon];
    cases.push({
      originIndex: origin,
      horizon,
      actual,
      forecasts: forecastBaselines(training, origin, horizon),
    });
  }
  return cases;
}

function clampProbability(value: number) {
  return Math.min(1 - 1e-9, Math.max(1e-9, value));
}

// Abramowitz-Stegun approximation, sufficient for a transparent baseline
// probability; final calibration must be evaluated on out-of-sample cases.
function erfApprox(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return sign * y;
}
