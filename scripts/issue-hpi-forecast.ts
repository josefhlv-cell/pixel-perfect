import { fetchEurostatHousePriceIndex } from "../src/lib/future-os/adapters/eurostat.server";
import { eurostatIndexRows, sealHousePriceIndex } from "../src/lib/future-os/predictive-core/publish";

const observations = await fetchEurostatHousePriceIndex(["CZ"]);
const rows = eurostatIndexRows(observations);
const retrievedAt = observations.reduce((latest, row) => row.retrievedAt > latest ? row.retrievedAt : latest, observations[0]?.retrievedAt ?? new Date().toISOString());
const sealed = await sealHousePriceIndex({ rows, retrievedAt, region: "CZ", horizonQuarters: 4 });
const report = sealed.report;
const issued = report.issued;
console.log(JSON.stringify({
  claim: report.claim,
  promotable: report.promotable,
  champion: report.champion,
  issuedModel: report.issuedModel,
  scoredOrigins: report.scoredOrigins,
  origin: issued?.originPeriod ?? null,
  horizonPeriod: sealed.horizonPeriod,
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
  contractHash: sealed.contractHash,
  observations: rows.length,
}, null, 2));
