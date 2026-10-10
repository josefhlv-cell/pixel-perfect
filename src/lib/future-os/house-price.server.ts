import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { fetchEurostatHousePriceIndex } from "./adapters/eurostat.server";
import {
  CZECH_HPI_SERIES,
  CZECH_HPI_TARGET,
  eurostatIndexRows,
  scoreFrozenForecast,
  sealHousePriceIndex,
  type ForecastRealization,
  type IndexPoint,
  type SealedHousePriceForecast,
} from "./predictive-core/publish";
import type { ForecastClaim, ModelComparison } from "./predictive-core/engine";

const CACHE_MS = 30 * 60 * 1000;
type Admin = SupabaseClient<Database>;
type ForecastRow = Database["public"]["Tables"]["reality_forecast_runs"]["Row"];
type ForecastInsert = Database["public"]["Tables"]["reality_forecast_runs"]["Insert"];
type OutcomeInsert = Database["public"]["Tables"]["reality_forecast_outcomes"]["Insert"];

export type CzechForecastJournalRow = {
  contractHash: string;
  createdAt: string;
  model: string;
  claim: string | null;
  p50: number | null;
  realized: number | null;
  insideInterval: boolean | null;
};

export type CzechHousePriceView = {
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
  persisted: boolean;
  persistError: string | null;
  journal: CzechForecastJournalRow[];
} | {
  ok: false;
  error: string;
};

let cache: { at: number; rows: IndexPoint[]; sealed: SealedHousePriceForecast } | null = null;

export async function issueAndRememberCzechHousePrices(reader: Admin): Promise<CzechHousePriceView> {
  let loaded: { rows: IndexPoint[]; sealed: SealedHousePriceForecast };
  try {
    loaded = await loadSealedCzechHousePrices();
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Eurostat teď neodpověděl." };
  }

  let persisted = false;
  let persistError: string | null = null;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await rememberForecast(supabaseAdmin, loaded.sealed, loaded.rows);
    persisted = true;
  } catch (error) {
    persistError = error instanceof Error ? error.message : "Journal se nepodařilo zapsat.";
  }

  let journal: CzechForecastJournalRow[] = [];
  try {
    journal = await readJournal(reader);
  } catch (error) {
    persistError ??= error instanceof Error ? error.message : "Journal se nepodařilo načíst.";
  }

  return viewOf(loaded.sealed, { persisted, persistError, journal });
}

async function loadSealedCzechHousePrices(): Promise<{ rows: IndexPoint[]; sealed: SealedHousePriceForecast }> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache;
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
  cache = { at: Date.now(), rows, sealed };
  return cache;
}

async function rememberForecast(admin: Admin, sealed: SealedHousePriceForecast, rows: readonly IndexPoint[]): Promise<void> {
  const issued = sealed.report.issued;
  if (!issued || sealed.originLevel == null || sealed.horizonPeriod == null) return;
  const existing = await admin
    .from("reality_forecast_runs")
    .select("id")
    .eq("forecast_key", sealed.contractHash)
    .limit(1);
  if (existing.error) throw new Error(existing.error.message);
  if (!existing.data?.length) {
    const horizonDays = Math.round((Date.parse(sealed.horizonPeriod) - Date.parse(issued.originPeriod)) / 86_400_000);
    const assumptions: Json = {
      evidenceClass: sealed.report.evidenceClass,
      promotable: sealed.report.promotable,
      champion: sealed.report.champion,
      caveat: sealed.report.caveat,
      contractHash: sealed.contractHash,
      scoredOrigins: sealed.report.scoredOrigins,
      originPeriod: issued.originPeriod,
      originLevel: sealed.originLevel,
      horizonPeriod: sealed.horizonPeriod,
      horizonQuarters: sealed.report.horizonQuarters,
      seriesId: sealed.report.seriesId,
      p10: issued.p10,
      p50: issued.p50,
      p90: issued.p90,
      probabilityPositive: issued.probabilityPositive,
      comparisons: sealed.report.comparisons.map((row) => ({ ...row })),
    };
    const insert: ForecastInsert = {
      forecast_key: sealed.contractHash,
      geography_type: "country",
      geography_key: "CZ",
      target_key: CZECH_HPI_TARGET,
      horizon_days: horizonDays,
      data_cutoff: issued.asOf,
      model_version: sealed.report.issuedModel,
      baseline_version: "PERSIST",
      p10: issued.p10,
      p50: issued.p50,
      p90: issued.p90,
      probability_positive: issued.probabilityPositive,
      regime: sealed.report.claim,
      status: "PENDING",
      assumptions,
    };
    const written = await admin.from("reality_forecast_runs").insert(insert);
    if (written.error) throw new Error(written.error.message);
  }
  await scoreOpenForecasts(admin, rows, sealed.retrievedAt);
}

async function scoreOpenForecasts(admin: Admin, rows: readonly IndexPoint[], asOf: string): Promise<void> {
  const runs = await admin
    .from("reality_forecast_runs")
    .select("id,assumptions,p10,p50,p90")
    .eq("target_key", CZECH_HPI_TARGET)
    .order("forecast_created_at", { ascending: false })
    .limit(40);
  if (runs.error) throw new Error(runs.error.message);
  const ids = (runs.data ?? []).map((row) => row.id);
  if (!ids.length) return;
  const outcomes = await admin.from("reality_forecast_outcomes").select("forecast_id").in("forecast_id", ids);
  if (outcomes.error) throw new Error(outcomes.error.message);
  const scored = new Set((outcomes.data ?? []).map((row) => row.forecast_id));
  for (const run of runs.data ?? []) {
    if (scored.has(run.id)) continue;
    const realization = realizationFromStored(run, rows, asOf);
    if (!realization) continue;
    const outcome: OutcomeInsert = {
      forecast_id: run.id,
      outcome_as_of: realization.outcomeAsOf,
      realized_value: realization.realized,
      inside_interval: realization.insideInterval,
      absolute_error: realization.absoluteError,
      directional_hit: realization.directionalHit,
      brier_score: realization.brierScore,
      metrics: {
        evidence: "latest_revision_with_frozen_origin",
        note: "Origin level was frozen at issue. The horizon uses the latest published revision.",
      },
    };
    const written = await admin.from("reality_forecast_outcomes").insert(outcome);
    if (written.error && !/duplicate|unique/i.test(written.error.message)) throw new Error(written.error.message);
  }
}

export function realizationFromStored(
  run: Pick<ForecastRow, "assumptions" | "p10" | "p50" | "p90">,
  rows: readonly IndexPoint[],
  asOf: string,
): ForecastRealization | null {
  const stored = run.assumptions;
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return null;
  const originLevel = num(stored.originLevel);
  const horizonPeriod = typeof stored.horizonPeriod === "string" ? stored.horizonPeriod : null;
  const p10 = num(run.p10) ?? num(stored.p10);
  const p50 = num(run.p50) ?? num(stored.p50);
  const p90 = num(run.p90) ?? num(stored.p90);
  const probabilityPositive = num(stored.probabilityPositive);
  if (originLevel == null || horizonPeriod == null || p10 == null || p50 == null || p90 == null) return null;
  return scoreFrozenForecast({ p10, p50, p90, probabilityPositive, originLevel, horizonPeriod }, rows, asOf);
}

async function readJournal(reader: Admin): Promise<CzechForecastJournalRow[]> {
  const runs = await reader
    .from("reality_forecast_runs")
    .select("id,forecast_key,forecast_created_at,model_version,regime,p50,assumptions")
    .eq("target_key", CZECH_HPI_TARGET)
    .order("forecast_created_at", { ascending: false })
    .limit(8);
  if (runs.error) throw new Error(runs.error.message);
  const ids = (runs.data ?? []).map((row) => row.id);
  const outcomes = ids.length
    ? await reader.from("reality_forecast_outcomes").select("forecast_id,realized_value,inside_interval").in("forecast_id", ids)
    : { data: [], error: null };
  if (outcomes.error) throw new Error(outcomes.error.message);
  const byForecast = new Map((outcomes.data ?? []).map((row) => [row.forecast_id, row]));
  return (runs.data ?? []).map((row) => {
    const outcome = byForecast.get(row.id);
    const claim = typeof row.regime === "string" ? row.regime : null;
    return {
      contractHash: row.forecast_key,
      createdAt: row.forecast_created_at,
      model: row.model_version,
      claim,
      p50: num(row.p50),
      realized: num(outcome?.realized_value),
      insideInterval: outcome?.inside_interval ?? null,
    };
  });
}

function viewOf(
  sealed: SealedHousePriceForecast,
  extra: { persisted: boolean; persistError: string | null; journal: CzechForecastJournalRow[] },
): CzechHousePriceView {
  const issued = sealed.report.issued;
  const percent = issued
    ? { p10: Math.expm1(issued.p10) * 100, p50: Math.expm1(issued.p50) * 100, p90: Math.expm1(issued.p90) * 100 }
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
    persisted: extra.persisted,
    persistError: extra.persistError,
    journal: extra.journal,
  };
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}
