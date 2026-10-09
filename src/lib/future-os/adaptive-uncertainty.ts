export type CalibrationResidual = {
  asOf: string;
  absoluteResidual: number;
  signedResidual: number;
  regime?: string | null;
};

export type AdaptiveIntervalInput = {
  p50: number;
  residuals: CalibrationResidual[];
  targetCoverage?: number;
  regime?: string | null;
  regimeChanged?: boolean;
  minCalibrationSamples?: number;
  maxCalibrationSamples?: number;
};

export type AdaptiveIntervalResult = {
  p10: number;
  p50: number;
  p90: number;
  halfWidth: number;
  calibrationSamples: number;
  empiricalCoverage: number | null;
  regimeReset: boolean;
  calibrationRegime: string | null;
  status: "CALIBRATED" | "THIN_DATA" | "REGIME_RESET";
};

/**
 * Distribution-free style residual calibration for non-stationary forecasting.
 *
 * This is intentionally an interval calibration layer, not a claim of
 * conditional coverage. A regime change resets the calibration pool so old
 * errors cannot silently dominate a new market regime.
 */
export function calibrateAdaptiveInterval(input: AdaptiveIntervalInput): AdaptiveIntervalResult {
  const targetCoverage = Math.min(0.999, Math.max(0.5, input.targetCoverage ?? 0.8));
  const minSamples = Math.max(5, input.minCalibrationSamples ?? 20);
  const maxSamples = Math.max(minSamples, input.maxCalibrationSamples ?? 120);

  const ordered = [...input.residuals].sort((a, b) => +new Date(a.asOf) - +new Date(b.asOf));
  const regimePool = input.regime && !input.regimeChanged
    ? ordered.filter(row => !row.regime || row.regime === input.regime)
    : ordered;
  const pool = regimePool.slice(-maxSamples);
  const reset = Boolean(input.regimeChanged);

  if (pool.length < minSamples) {
    const fallback = pool.map(row => Math.abs(row.signedResidual));
    const width = fallback.length ? quantile(fallback, targetCoverage) : 0;
    return {
      p10: input.p50 - width,
      p50: input.p50,
      p90: input.p50 + width,
      halfWidth: width,
      calibrationSamples: pool.length,
      empiricalCoverage: null,
      regimeReset: reset,
      calibrationRegime: input.regime ?? null,
      status: reset ? "REGIME_RESET" : "THIN_DATA",
    };
  }

  const absoluteErrors = pool.map(row => Math.abs(row.signedResidual));
  const halfWidth = quantile(absoluteErrors, targetCoverage);
  return {
    p10: input.p50 - halfWidth,
    p50: input.p50,
    p90: input.p50 + halfWidth,
    halfWidth,
    calibrationSamples: pool.length,
    empiricalCoverage: empiricalCoverage(pool, halfWidth),
    regimeReset: reset,
    calibrationRegime: input.regime ?? null,
    status: reset ? "REGIME_RESET" : "CALIBRATED",
  };
}

function quantile(values: number[], q: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const p = (sorted.length - 1) * q;
  const lo = Math.floor(p);
  const hi = Math.ceil(p);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (p - lo);
}

function empiricalCoverage(pool: CalibrationResidual[], halfWidth: number) {
  return pool.length
    ? pool.filter(row => Math.abs(row.signedResidual) <= halfWidth).length / pool.length
    : null;
}

/**
 * Exponentially weighted residual scale. Recent forecast errors receive more
 * weight, which makes the uncertainty layer react faster after drift.
 */
export function exponentiallyWeightedResidualScale(
  residuals: CalibrationResidual[],
  decay = 0.94,
) {
  const ordered = [...residuals].sort((a, b) => +new Date(a.asOf) - +new Date(b.asOf));
  if (!ordered.length) return 0;
  const safeDecay = Math.min(0.9999, Math.max(0.5, decay));
  let weightedSum = 0;
  let totalWeight = 0;

  ordered.forEach((row, index) => {
    const weight = safeDecay ** (ordered.length - 1 - index);
    weightedSum += Math.abs(row.signedResidual) * weight;
    totalWeight += weight;
  });

  return totalWeight ? weightedSum / totalWeight : 0;
}
