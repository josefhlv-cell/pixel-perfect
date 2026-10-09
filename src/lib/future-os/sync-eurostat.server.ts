import { fetchEurostatHousePriceIndex } from "./adapters/eurostat.server";
import { ingestEvidence } from "./ingest.server";

export async function syncEurostatHousePrices(geos: string[] = ["CZ"]) {
  const observations = await fetchEurostatHousePriceIndex(geos);
  return ingestEvidence("eurostat-prc-hpi-q", observations);
}
