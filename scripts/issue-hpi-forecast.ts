import { fetchEurostatHousePriceIndex } from "../src/lib/future-os/adapters/eurostat.server";
import { runHousePriceForecast, sealForecastReport } from "../src/lib/future-os/predictive-core/engine";
import { quarterlyIndexToLevels } from "../src/lib/future-os/predictive-core/levels";

const observations = await fetchEurostatHousePriceIndex(["CZ"]);
const rows = observations.flatMap((row) => {
  const value = row.value as { value?: number; period?: string };
  if (typeof value?.value !== "number" || typeof value.period !== "string") return [];
  return [{ period: value.period, value: value.value }];
});
const retrievedAt = observations.reduce((latest, row) => row.retrievedAt > latest ? row.retrievedAt : latest, observations[0]?.retrievedAt ?? new Date().toISOString());
const report = runHousePriceForecast({
  seriesId: "eurostat:prc_hpi_q:TOTAL:I15_Q",
  region: "CZ",
  levels: quarterlyIndexToLevels(rows),
  horizonQuarters: 4,
  asOf: retrievedAt,
});
const hash = await sealForecastReport(report);
const issued = report.issued;
console.log(JSON.stringify({
  claim: report.claim,
  promotable: report.promotable,
  champion: report.champion,
  issuedModel: report.issuedModel,
  scoredOrigins: report.scoredOrigins,
  origin: issued?.originPeriod ?? null,
  asOf: issued?.asOf ?? null,
  p10: issued?.p10 ?? null,
  p50: issued?.p50 ?? null,
  p90: issued?.p90 ?? null,
  probabilityPositive: issued?.probabilityPositive ?? null,
  approxPercent: issued ? {
    p10: Math.expm1(issued.p10) * 100,
    p50: Math.expm1(issued.p50) * 100,
    p90: Math.expm1(issued.p90) * 100,
  } : null,
  comparisons: report.comparisons,
  caveat: report.caveat,
  contractHash: hash,
  observations: rows.length,
}, null, 2));
