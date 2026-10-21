import { fetchEurostatHousePriceIndex } from "./adapters/eurostat.server";
import {
  CZECH_HPI_SERIES,
  eurostatIndexRows,
  sealHousePriceIndex,
  type SealedHousePriceForecast,
} from "./predictive-core/publish";
import type { ForecastClaim, ModelComparison } from "./predictive-core/engine";

const CACHE_MS = 30 * 60 * 1000;

export type CzechForecastJournalRow = {
  contractHash: string;
  createdAt: string;
  model: string;
  claim: string | null;
  p50: number | null;
  realized: number | null;
  insideInterval: boolean | null;
};

export type CzechHousePriceView =
  | {
      ok: true;
      claim: ForecastClaim;
      promotable: boolean;
      evidenceClass: SealedHousePriceForecast["report"]["evidenceClass"];
      champion: string | null;
      issuedModel: string;
      scoredOrigins: number;
      originPeriod: string | null;
      asOf: string | null;
      horizonQuarters: number;
      horizonPeriod: string | null;
      p10: number | null;
      p50: number | null;
      p90: number | null;
      percent: { p10: number; p50: number; p90: number } | null;
      probabilityPositive: number | null;
      caveat: string;
      contractHash: string;
      comparisons: readonly ModelComparison[];
      persisted: false;
      persistError: null;
      journal: readonly CzechForecastJournalRow[];
    }
  | {
      ok: false;
      error: string;
    };

let cache: { at: number; sealed: SealedHousePriceForecast } | null = null;

/** Live Czech HPI contract. Nothing is written: the forecast journal stays closed until access rules are reviewed. */
export async function issueCzechHousePriceForecast(): Promise<CzechHousePriceView> {
  try {
    const sealed = await loadSealedCzechHousePrices();
    return viewOf(sealed);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Eurostat teď neodpověděl.",
    };
  }
}

async function loadSealedCzechHousePrices(): Promise<SealedHousePriceForecast> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.sealed;
  const observations = await fetchEurostatHousePriceIndex(["CZ"]);
  const rows = eurostatIndexRows(observations);
  if (rows.length < 16) throw new Error("Eurostat vrátil příliš krátkou řadu cen bytů.");
  const retrievedAt = observations.reduce(
    (latest, row) => (row.retrievedAt > latest ? row.retrievedAt : latest),
    observations[0]?.retrievedAt ?? new Date().toISOString(),
  );
  const sealed = await sealHousePriceIndex({
    rows,
    retrievedAt,
    seriesId: CZECH_HPI_SERIES,
    region: "CZ",
    horizonQuarters: 4,
  });
  cache = { at: Date.now(), sealed };
  return sealed;
}

function viewOf(sealed: SealedHousePriceForecast): CzechHousePriceView {
  const issued = sealed.report.issued;
  const percent = issued
    ? {
        p10: Math.expm1(issued.p10) * 100,
        p50: Math.expm1(issued.p50) * 100,
        p90: Math.expm1(issued.p90) * 100,
      }
    : null;
  return {
    ok: true,
    claim: sealed.report.claim,
    promotable: sealed.report.promotable,
    evidenceClass: sealed.report.evidenceClass,
    champion: sealed.report.champion,
    issuedModel: sealed.report.issuedModel,
    scoredOrigins: sealed.report.scoredOrigins,
    originPeriod: issued?.originPeriod ?? null,
    asOf: issued?.asOf ?? null,
    horizonQuarters: sealed.report.horizonQuarters,
    horizonPeriod: sealed.horizonPeriod,
    p10: issued?.p10 ?? null,
    p50: issued?.p50 ?? null,
    p90: issued?.p90 ?? null,
    percent,
    probabilityPositive: issued?.probabilityPositive ?? null,
    caveat: sealed.report.caveat,
    contractHash: sealed.contractHash,
    comparisons: sealed.report.comparisons,
    persisted: false,
    persistError: null,
    journal: [],
  };
}
