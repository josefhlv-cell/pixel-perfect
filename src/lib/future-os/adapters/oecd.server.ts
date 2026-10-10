import type { EvidenceObservation } from "../types";

const OECD_BASE = "https://sdmx.oecd.org/public/rest/v1/data";
const FLOW = "OECD.ECO.MPD,DSD_AN_HOUSE_PRICES@DF_HOUSE_PRICES,1.0";

type SdmxDimension = { id: string; values: Array<{ id: string; name?: string }> };
type SdmxJson = { data?: { dataSets?: Array<{ observations?: Record<string, number[]> }> }; structure?: { dimensions?: { observation?: SdmxDimension[] } } };

function periodStart(period: string): string | null {
  if (/^\\d{4}$/.test(period)) return period + "-01-01T00:00:00.000Z";
  const q = /^(\\d{4})-Q([1-4])$/.exec(period);
  if (q) return q[1] + "-" + String((Number(q[2]) - 1) * 3 + 1).padStart(2, "0") + "-01T00:00:00.000Z";
  return null;
}

function parseObservations(dataset: SdmxJson) {
  const dimensions = dataset.structure?.dimensions?.observation ?? [];
  const observations = dataset.data?.dataSets?.[0]?.observations ?? {};
  const values = dimensions.map((dimension) => dimension.values);
  const result: Array<{ period: string; value: number }> = [];
  const timeIndex = dimensions.findIndex((dimension) => dimension.id === "TIME_PERIOD");
  if (timeIndex < 0) return result;
  for (const [key, payload] of Object.entries(observations)) {
    const indices = key.split(":").map(Number);
    const period = values[timeIndex]?.[indices[timeIndex] ?? -1]?.id;
    const value = payload[0];
    if (!period || typeof value !== "number" || !Number.isFinite(value)) continue;
    result.push({ period, value });
  }
  return result;
}

export async function fetchOecdHousePrices(geos: string[] = ["CZE"], startPeriod = "2000", endPeriod = "2026", signal?: AbortSignal): Promise<EvidenceObservation[]> {
  const retrievedAt = new Date().toISOString();
  const observations: EvidenceObservation[] = [];
  for (const geo of geos) {
    const url = new URL(OECD_BASE + "/" + FLOW + "/" + geo + ".Q.HPI.");
    url.searchParams.set("startPeriod", startPeriod);
    url.searchParams.set("endPeriod", endPeriod);
    url.searchParams.set("dimensionAtObservation", "AllDimensions");
    const response = await fetch(url.toString(), { signal, headers: { accept: "application/vnd.sdmx.data+json;version=2.0.0" } });
    if (!response.ok) throw new Error("OECD HTTP " + response.status);
    const dataset = await response.json() as SdmxJson;
    for (const point of parseObservations(dataset)) {
      const effectiveFrom = periodStart(point.period);
      if (!effectiveFrom) continue;
      observations.push({
        id: "oecd:hpi:" + geo + ":" + point.period, sourceId: "oecd-housing-sdmx", sourceName: "OECD Analytical House Prices",
        sourceType: "official_statistical", sourceUrl: url.toString(), publisher: "OECD", geographyType: "country", geographyKey: geo,
        entityType: "series", entityKey: "house_price_index_nominal", observedAt: effectiveFrom, publishedAt: null, retrievedAt, availableAt: retrievedAt,
        effectiveFrom, effectiveTo: null, revision: 1, value: point.value, unit: "index", frequency: "quarterly", leadClass: "LAGGING",
        sourceReliability: 0.98, independenceGroup: "oecd", contentHash: ["oecd","hpi",geo,point.period,point.value].join("|"),
        isRevision: false, supersedesId: null, metadata: { dataset: FLOW, period: point.period, pointInTimeMode: "conservative_retrieval_cutoff" }, createdAt: retrievedAt,
      });
    }
  }
  return observations;
}