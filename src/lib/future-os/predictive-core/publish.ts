import { runHousePriceForecast, sealForecastReport, type HousePriceForecastReport } from "./engine";
import { addDays, levelsVisibleAt, logReturn, quarterlyIndexToLevels, quarterStartIso, type LevelObservation } from "./levels";

export const CZECH_HPI_SERIES = "eurostat:prc_hpi_q:TOTAL:I15_Q";
export const CZECH_HPI_TARGET = `${CZECH_HPI_SERIES}:h4_log_return`;

export type IndexPoint = { period: string; value: number };

export function eurostatIndexRows(observations: readonly { value: unknown }[]): IndexPoint[] {
  const byPeriod = new Map<string, number>();
  for (const row of observations) {
    const value = row.value as { value?: unknown; period?: unknown };
    if (typeof value?.value !== "number" || !Number.isFinite(value.value) || value.value <= 0) continue;
    if (typeof value.period !== "string" || !/^\d{4}-Q[1-4]$/.test(value.period)) continue;
    byPeriod.set(value.period, value.value);
  }
  return [...byPeriod.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, value]) => ({ period, value }));
}

export type SealedHousePriceForecast = {
  report: HousePriceForecastReport;
  contractHash: string;
  originLevel: number | null;
  horizonPeriod: string | null;
  retrievedAt: string;
};

export type ForecastRealization = {
  realized: number;
  insideInterval: boolean;
  absoluteError: number;
  directionalHit: boolean;
  brierScore: number | null;
  outcomeAsOf: string;
};

/** One sealed contract. The hash covers the issued distribution, not the prose around it. */
export async function sealHousePriceIndex(input: {
  rows: readonly IndexPoint[];
  retrievedAt: string;
  seriesId?: string;
  region?: string;
  horizonQuarters?: number;
  rates?: readonly LevelObservation[];
}): Promise<SealedHousePriceForecast> {
  if (!Number.isFinite(Date.parse(input.retrievedAt))) throw new Error(`Invalid retrievedAt: ${input.retrievedAt}`);
  const levels = quarterlyIndexToLevels(input.rows);
  const report = runHousePriceForecast({
    seriesId: input.seriesId ?? CZECH_HPI_SERIES,
    region: input.region ?? "CZ",
    levels,
    rates: input.rates,
    horizonQuarters: input.horizonQuarters ?? 4,
    asOf: input.retrievedAt,
  });
  const contractHash = await sealForecastReport(report);
  const issued = report.issued;
  const visible = issued ? levelsVisibleAt(levels, issued.asOf) : [];
  const originLevel = issued ? visible.find((row) => row.period === issued.originPeriod)?.level ?? null : null;
  return {
    report,
    contractHash,
    originLevel,
    horizonPeriod: issued ? addQuarters(issued.originPeriod, report.horizonQuarters) : null,
    retrievedAt: input.retrievedAt,
  };
}

/**
 * Score a sealed contract only after the horizon quarter's own vintage is visible.
 * The origin level is the one frozen at issue time, never a later revision of that quarter.
 */
export function realizeSealedForecast(
  sealed: Pick<SealedHousePriceForecast, "report" | "originLevel" | "horizonPeriod">,
  rows: readonly IndexPoint[],
  asOf: string,
): ForecastRealization | null {
  const issued = sealed.report.issued;
  if (!issued || sealed.originLevel == null || sealed.horizonPeriod == null) return null;
  return scoreFrozenForecast({
    p10: issued.p10,
    p50: issued.p50,
    p90: issued.p90,
    probabilityPositive: issued.probabilityPositive,
    originLevel: sealed.originLevel,
    horizonPeriod: sealed.horizonPeriod,
  }, rows, asOf);
}

/** Score levels frozen at issue time. Later revisions of the origin quarter are ignored. */
export function scoreFrozenForecast(
  frozen: {
    p10: number;
    p50: number;
    p90: number;
    probabilityPositive: number | null;
    originLevel: number;
    horizonPeriod: string;
  },
  rows: readonly IndexPoint[],
  asOf: string,
): ForecastRealization | null {
  if (!(frozen.originLevel > 0)) return null;
  const future = levelsVisibleAt(quarterlyIndexToLevels(rows), asOf).find((row) => row.period === frozen.horizonPeriod);
  if (!future) return null;
  const hit = (realized: number) => (realized >= 0 ? 1 : 0);
  const realized = logReturn(future.level, frozen.originLevel);
  return {
    realized,
    insideInterval: realized >= frozen.p10 && realized <= frozen.p90,
    absoluteError: Math.abs(frozen.p50 - realized),
    directionalHit: frozen.p50 >= 0 ? realized >= 0 : realized < 0,
    brierScore: frozen.probabilityPositive == null || !Number.isFinite(frozen.probabilityPositive)
      ? null
      : (frozen.probabilityPositive - hit(realized)) ** 2,
    // This adapter only has the retrieval timestamp, not archived source vintages.
    // Never mislabel the assumed publication-lag date as the actual observation time.
    outcomeAsOf: asOf,
  };
}

export function addQuarters(iso: string, quarters: number): string {
  const time = Date.parse(iso);
  if (!Number.isFinite(time) || !Number.isInteger(quarters)) throw new Error("Invalid quarter shift.");
  const date = new Date(time);
  const month = date.getUTCMonth() + quarters * 3;
  return new Date(Date.UTC(date.getUTCFullYear() + Math.floor(month / 12), ((month % 12) + 12) % 12, date.getUTCDate())).toISOString();
}

export function vintageOfQuarter(period: string, lagDays: number): string {
  return addDays(quarterStartIso(period), lagDays);
}
