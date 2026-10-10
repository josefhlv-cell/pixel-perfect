import { compareForecastToBenchmark, type ForecastEvaluationSample } from "../forecast-evaluation";
import { levelsVisibleAt, logReturn, type LevelObservation } from "./levels";
import { fitModels, trainingPairs, type DistributionForecast, type ForecastModelId } from "./models";

export type EvidenceClass = "OBSERVED_VINTAGE" | "ASSUMED_LAG_LATEST_REVISION";
export type ForecastClaim = "EDGE" | "NO_EDGE" | "INSUFFICIENT_SAMPLE";

export type ModelComparison = {
  modelId: Exclude<ForecastModelId, "PERSIST">;
  mae: number;
  benchmarkMae: number;
  improvement: number;
  confidenceLow: number;
  confidenceHigh: number;
  significant: boolean;
};

export type IssuedForecast = DistributionForecast & {
  originPeriod: string;
  asOf: string;
  horizonQuarters: number;
};

export type HousePriceForecastReport = {
  seriesId: string;
  region: string;
  horizonQuarters: number;
  evidenceClass: EvidenceClass;
  promotable: boolean;
  scoredOrigins: number;
  claim: ForecastClaim;
  champion: ForecastModelId | null;
  issuedModel: ForecastModelId;
  issued: IssuedForecast | null;
  comparisons: readonly ModelComparison[];
  caveat: string;
};

const MIN_SCORED = 20;

/**
 * Direct h-step log-return forecast.
 * Fitting sees only levels whose vintageDate is <= the origin vintage.
 * Persistence is replaced only when the paired block bootstrap shows a lower
 * out-of-sample MAE. Assumed lags are never promotable. RATE_LAG is ignored
 * unless that same test says the rate earned the edge.
 */
export function runHousePriceForecast(input: {
  seriesId: string;
  region: string;
  levels: readonly LevelObservation[];
  rates?: readonly LevelObservation[];
  horizonQuarters?: number;
  /** Forecast clock. Levels whose vintage is after this instant stay invisible. */
  asOf?: string;
}): HousePriceForecastReport {
  const horizon = input.horizonQuarters ?? 4;
  if (!Number.isInteger(horizon) || horizon < 1) throw new Error("Horizon must be a positive integer.");
  const periods = uniquePeriods(input.levels).filter((period) => Date.parse(earliestVintage(input.levels, period)) <= clockOf(input));
  assertQuarterly(periods);
  const evidenceClass = evidenceOf(input.levels);
  const scored: Array<{ realized: number; forecasts: DistributionForecast[] }> = [];

  for (let origin = horizon; origin + horizon < periods.length; origin += 1) {
    const asOf = earliestVintage(input.levels, periods[origin]);
    const forecasts = forecastAt(input.levels, input.rates ?? [], periods, origin, horizon, asOf);
    if (!forecasts) continue;
    const futureAsOf = earliestVintage(input.levels, periods[origin + horizon]);
    const future = valueAt(input.levels, periods[origin + horizon], futureAsOf);
    const current = valueAt(input.levels, periods[origin], asOf);
    if (future == null || current == null) continue;
    scored.push({ realized: logReturn(future, current), forecasts });
  }

  const clock = new Date(clockOf(input)).toISOString();
  const liveVisible = levelsVisibleAt(input.levels, clock);
  const liveOrigin = liveVisible.findIndex((row) => row.period === periods[periods.length - 1]);
  const liveForecasts = liveOrigin >= horizon
    ? forecastAt(input.levels, input.rates ?? [], periods, periods.indexOf(liveVisible[liveOrigin].period), horizon, liveVisible[liveOrigin].vintageDate)
    : null;

  const comparisons = compareAll(scored);
  const edge = comparisons
    .filter((comparison) => comparison.significant && comparison.improvement > 0)
    .sort((a, b) => b.improvement - a.improvement)[0];
  const claim: ForecastClaim = scored.length < MIN_SCORED ? "INSUFFICIENT_SAMPLE" : edge ? "EDGE" : "NO_EDGE";
  const champion = claim === "EDGE" ? edge.modelId : null;
  const issuedModel: ForecastModelId = champion && liveForecasts?.some((forecast) => forecast.modelId === champion) ? champion : "PERSIST";
  const selected = liveForecasts?.find((forecast) => forecast.modelId === issuedModel) ?? null;
  const issued: IssuedForecast | null = selected && liveForecasts
    ? {
        ...selected,
        originPeriod: periods[periods.length - 1],
        asOf: liveVisible[liveOrigin].vintageDate,
        horizonQuarters: horizon,
      }
    : null;

  return {
    seriesId: input.seriesId,
    region: input.region,
    horizonQuarters: horizon,
    evidenceClass,
    promotable: evidenceClass === "OBSERVED_VINTAGE" && claim === "EDGE" && issuedModel === champion,
    scoredOrigins: scored.length,
    claim,
    champion,
    issuedModel,
    issued,
    comparisons,
    caveat: caveatFor(evidenceClass, champion, issuedModel),
  };
}

export async function sealForecastReport(report: HousePriceForecastReport): Promise<string> {
  const issued = report.issued;
  const canonical = JSON.stringify({
    seriesId: report.seriesId,
    region: report.region,
    horizonQuarters: report.horizonQuarters,
    evidenceClass: report.evidenceClass,
    claim: report.claim,
    issuedModel: report.issuedModel,
    originPeriod: issued?.originPeriod ?? null,
    asOf: issued?.asOf ?? null,
    p10: issued?.p10 ?? null,
    p50: issued?.p50 ?? null,
    p90: issued?.p90 ?? null,
    probabilityPositive: issued?.probabilityPositive ?? null,
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function forecastAt(
  levels: readonly LevelObservation[],
  rates: readonly LevelObservation[],
  periods: readonly string[],
  origin: number,
  horizon: number,
  asOf: string,
): DistributionForecast[] | null {
  const visible = levelsVisibleAt(levels, asOf);
  if (visible.at(-1)?.period !== periods[origin]) return null;
  if (visible.length < origin + 1) return null;
  const logLevels = visible.map((row) => Math.log(row.level));
  const deltas = visible.map((row, index) => {
    if (index < horizon) return null;
    return rateDelta(rates, visible[index - horizon].period, row.period, asOf);
  });
  const pairs = trainingPairs(logLevels, origin, horizon, deltas);
  const forecasts = fitModels(pairs, logLevels[origin] - logLevels[origin - horizon], deltas[origin] ?? null);
  return forecasts.some((forecast) => forecast.modelId === "PERSIST") ? forecasts : null;
}

function rateDelta(rates: readonly LevelObservation[], earlierPeriod: string, laterPeriod: string, asOf: string): number | null {
  const earlier = valueAt(rates, earlierPeriod, asOf);
  const later = valueAt(rates, laterPeriod, asOf);
  if (earlier == null || later == null) return null;
  return later - earlier;
}

function valueAt(rows: readonly LevelObservation[], period: string, asOf: string): number | null {
  const cutoff = Date.parse(asOf);
  const visible = rows.filter((row) => row.period === period && Date.parse(row.vintageDate) <= cutoff);
  if (!visible.length) return null;
  visible.sort((a, b) => Date.parse(a.vintageDate) - Date.parse(b.vintageDate));
  return visible[visible.length - 1].level;
}

function earliestVintage(rows: readonly LevelObservation[], period: string): string {
  const matches = rows.filter((row) => row.period === period);
  if (!matches.length) throw new Error(`Missing period ${period}.`);
  return matches.map((row) => row.vintageDate).sort()[0];
}

function uniquePeriods(rows: readonly LevelObservation[]): string[] {
  return [...new Set(rows.map((row) => row.period))].sort((a, b) => Date.parse(a) - Date.parse(b));
}

function assertQuarterly(periods: readonly string[]): void {
  for (let i = 1; i < periods.length; i += 1) {
    const days = (Date.parse(periods[i]) - Date.parse(periods[i - 1])) / 86_400_000;
    if (days < 80 || days > 100) throw new Error(`Series is not regular quarterly around ${periods[i]}.`);
  }
}

function compareAll(scored: Array<{ realized: number; forecasts: DistributionForecast[] }>): ModelComparison[] {
  const ids = [...new Set(scored.flatMap((row) => row.forecasts.map((forecast) => forecast.modelId)))].filter(
    (modelId): modelId is Exclude<ForecastModelId, "PERSIST"> => modelId !== "PERSIST",
  );
  return ids.flatMap((modelId) => {
    const samples: ForecastEvaluationSample[] = scored.flatMap((row) => {
      const candidate = row.forecasts.find((forecast) => forecast.modelId === modelId);
      const benchmark = row.forecasts.find((forecast) => forecast.modelId === "PERSIST");
      if (!candidate || !benchmark) return [];
      return [{
        actual: row.realized,
        baselineActual: 0,
        candidate: { p50: candidate.p50, probabilityPositive: candidate.probabilityPositive },
        benchmark: { p50: benchmark.p50, probabilityPositive: benchmark.probabilityPositive },
      }];
    });
    const comparison = compareForecastToBenchmark(samples, "MAE", 4, 800);
    if (!comparison) return [];
    return [{
      modelId,
      mae: comparison.candidateMean,
      benchmarkMae: comparison.benchmarkMean,
      improvement: comparison.improvement,
      confidenceLow: comparison.confidenceLow,
      confidenceHigh: comparison.confidenceHigh,
      significant: comparison.significant,
    }];
  });
}

function evidenceOf(rows: readonly LevelObservation[]): EvidenceClass {
  return rows.length > 0 && rows.every((row) => row.quality === "OBSERVED_VINTAGE")
    ? "OBSERVED_VINTAGE"
    : "ASSUMED_LAG_LATEST_REVISION";
}

function clockOf(input: { levels: readonly LevelObservation[]; asOf?: string }): number {
  if (input.asOf) {
    const time = Date.parse(input.asOf);
    if (!Number.isFinite(time)) throw new Error(`Invalid asOf: ${input.asOf}`);
    return time;
  }
  return input.levels.reduce((max, row) => Math.max(max, Date.parse(row.vintageDate)), 0);
}

function caveatFor(evidenceClass: EvidenceClass, champion: ForecastModelId | null, issuedModel: ForecastModelId): string {
  const base = evidenceClass === "OBSERVED_VINTAGE"
    ? "Observed vintages. A single edge is not a decision; the frozen pilot protocol still has to clear it."
    : "Assumed publication lag on latest revisions. This cannot promote a champion or authorize a purchase.";
  if (champion && issuedModel !== champion) return `${base} The backtest champion could not be fit at the latest origin, so persistence was issued.`;
  return base;
}
