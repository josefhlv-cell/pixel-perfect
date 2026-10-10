/**
 * Proper scores and calibration diagnostics for probabilistic forecasts.
 *
 * This module summarizes already-issued forecasts; it does not train a model.
 * Keep evaluations chronological and segment results by target and horizon.
 */
export type ProbabilisticForecastObservation = {
  issuedAt: string;
  outcomeObservedAt: string;
  actual: number;
  p10: number;
  p50: number;
  p90: number;
  probabilityPositive: number;
  baselineValue: number;
};

export type ProbabilisticForecastMetrics = {
  sampleCount: number;
  mae: number | null;
  meanBias: number | null;
  intervalCoverage80: number | null;
  meanIntervalWidth80: number | null;
  intervalScore80: number | null;
  brierScore: number | null;
  logLoss: number | null;
  directionalAccuracy: number | null;
  directionalSampleCount: number;
  calibrationBins: Array<{
    lowerProbability: number;
    upperProbability: number;
    sampleCount: number;
    meanPredictedProbability: number | null;
    observedFrequency: number | null;
  }>;
};

function validateObservation(row: ProbabilisticForecastObservation): boolean {
  return Boolean(
    row &&
    Number.isFinite(Date.parse(row.issuedAt)) &&
    Number.isFinite(Date.parse(row.outcomeObservedAt)) &&
    Date.parse(row.issuedAt) < Date.parse(row.outcomeObservedAt) &&
    Number.isFinite(row.actual) &&
    Number.isFinite(row.p10) &&
    Number.isFinite(row.p50) &&
    Number.isFinite(row.p90) &&
    row.p10 <= row.p50 &&
    row.p50 <= row.p90 &&
    Number.isFinite(row.probabilityPositive) &&
    row.probabilityPositive >= 0 &&
    row.probabilityPositive <= 1 &&
    Number.isFinite(row.baselineValue)
  );
}

export function evaluateProbabilisticForecasts(
  observations: ProbabilisticForecastObservation[],
  asOf: string,
  options: { binCount?: number; alpha?: number } = {},
): ProbabilisticForecastMetrics {
  const cutoff = Date.parse(asOf);
  if (!Number.isFinite(cutoff)) throw new RangeError("asOf must be a valid date-time");
  const binCount = options.binCount ?? 10;
  const alpha = options.alpha ?? 0.2;
  if (!Number.isInteger(binCount) || binCount < 1 || binCount > 100) {
    throw new RangeError("binCount must be an integer between 1 and 100");
  }
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha >= 1) {
    throw new RangeError("alpha must be strictly between 0 and 1");
  }

  const rows = observations
    .filter(validateObservation)
    .filter((row) => Date.parse(row.outcomeObservedAt) <= cutoff)
    .slice()
    .sort((a, b) => Date.parse(a.outcomeObservedAt) - Date.parse(b.outcomeObservedAt));

  if (rows.length === 0) {
    return {
      sampleCount: 0,
      mae: null,
      meanBias: null,
      intervalCoverage80: null,
      meanIntervalWidth80: null,
      intervalScore80: null,
      brierScore: null,
      logLoss: null,
      directionalAccuracy: null,
      directionalSampleCount: 0,
      calibrationBins: Array.from({ length: binCount }, (_, i) => ({
        lowerProbability: i / binCount,
        upperProbability: (i + 1) / binCount,
        sampleCount: 0,
        meanPredictedProbability: null,
        observedFrequency: null,
      })),
    };
  }

  const eps = 1e-12;
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const errors = rows.map((row) => row.p50 - row.actual);
  const covered = rows.map((row) => row.actual >= row.p10 && row.actual <= row.p90);
  const widths = rows.map((row) => row.p90 - row.p10);
  const intervalScores = rows.map((row, index) => {
    const lowMiss = Math.max(0, row.p10 - row.actual);
    const highMiss = Math.max(0, row.actual - row.p90);
    return widths[index]! + (2 / alpha) * (lowMiss + highMiss);
  });
  const brier = rows.map((row) => {
    const outcome = row.actual - row.baselineValue > 0 ? 1 : 0;
    return (row.probabilityPositive - outcome) ** 2;
  });
  const logLoss = rows.map((row) => {
    const outcome = row.actual - row.baselineValue > 0 ? 1 : 0;
    const p = Math.min(1 - eps, Math.max(eps, row.probabilityPositive));
    return -(outcome * Math.log(p) + (1 - outcome) * Math.log(1 - p));
  });
  const directional = rows.filter((row) => row.p50 !== row.baselineValue);
  const directionalHits = directional.filter(
    (row) => Math.sign(row.p50 - row.baselineValue) === Math.sign(row.actual - row.baselineValue),
  );

  const calibrationBins = Array.from({ length: binCount }, (_, i) => {
    const lowerProbability = i / binCount;
    const upperProbability = (i + 1) / binCount;
    const bin = rows.filter((row) => {
      const p = row.probabilityPositive;
      return p >= lowerProbability && (i === binCount - 1 ? p <= upperProbability : p < upperProbability);
    });
    return {
      lowerProbability,
      upperProbability,
      sampleCount: bin.length,
      meanPredictedProbability: bin.length ? mean(bin.map((row) => row.probabilityPositive)) : 0,
      observedFrequency: bin.length
        ? mean(bin.map((row) => (row.actual - row.baselineValue > 0 ? 1 : 0)))
        : 0,
    };
  });

  return {
    sampleCount: rows.length,
    mae: mean(errors.map(Math.abs)),
    meanBias: mean(errors),
    intervalCoverage80: mean(covered.map((value) => Number(value))),
    meanIntervalWidth80: mean(widths),
    intervalScore80: mean(intervalScores),
    brierScore: mean(brier),
    logLoss: mean(logLoss),
    directionalAccuracy: directional.length ? directionalHits.length / directional.length : 0,
    directionalSampleCount: directional.length,
    calibrationBins,
  };
}
