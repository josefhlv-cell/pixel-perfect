import type { EvidenceObservation } from "../types";

const BIS_BASE = "https://stats.bis.org/api/v2/data/dataflow/BIS/WS_SPP/1.0";

type Dimension = { id: string; values: Array<{ id: string; name?: string }> };
type Sdmx = {
  data?: {
    structure?: { dimensions?: { series?: Dimension[]; observation?: Dimension[] } };
    dataSets?: Array<{ series?: Record<string, { observations?: Record<string, number[]> }> }>;
  };
};

function quarterStart(period: string): string | null {
  const m = /^(\d{4})-Q([1-4])$/.exec(period);
  return m ? m[1] + "-" + String((Number(m[2]) - 1) * 3 + 1).padStart(2, "0") + "-01T00:00:00.000Z" : null;
}

function parseBIS(dataset: Sdmx, requestedGeos: string[]) {
  const structure = dataset.data?.structure;
  const seriesDimensions = structure?.dimensions?.series ?? [];
  const observationDimensions = structure?.dimensions?.observation ?? [];
  const rawSeries = dataset.data?.dataSets?.[0]?.series ?? {};
  const timeDimension = observationDimensions.find((d) => d.id === "TIME_PERIOD");
  const timeValues = timeDimension?.values ?? [];
  const geoIndex = seriesDimensions.findIndex((d) => d.id === "REF_AREA");
  const measureIndex = seriesDimensions.findIndex((d) => d.id === "VALUE_MEASURE");
  const rows: Array<{ geo: string; measure: string; period: string; value: number }> = [];

  for (const [seriesKey, seriesData] of Object.entries(rawSeries)) {
    const indices = seriesKey.split(":").map(Number);
    const geo = seriesDimensions[geoIndex]?.values[indices[geoIndex] ?? -1]?.id;
    const measure = measureIndex >= 0 ? seriesDimensions[measureIndex]?.values[indices[measureIndex] ?? -1]?.id ?? "" : "";
    if (!geo || (requestedGeos.length && !requestedGeos.includes(geo))) continue;
    for (const [obsKey, payload] of Object.entries(seriesData.observations ?? {})) {
      const timeIndex = Number(obsKey.split(":")[0]);
      const period = timeValues[timeIndex]?.id;
      const value = payload[0];
      if (!period || typeof value !== "number" || !Number.isFinite(value)) continue;
      rows.push({ geo, measure, period, value });
    }
  }
  return rows;
}

/**
 * BIS selected residential property prices (WS_SPP). BIS gives no per-observation publication time,
 * so availableAt = retrievedAt (conservative point-in-time cutoff).
 */
export async function fetchBisResidentialPropertyPrices(
  geos: string[] = ["CZ"],
  signal?: AbortSignal,
  measures: string[] = ["N", "R"],
): Promise<EvidenceObservation[]> {
  const key = "Q." + geos.join("+") + "." + measures.join("+");
  const url = BIS_BASE + "/" + encodeURIComponent(key) + "?format=jsondata";
  const retrievedAt = new Date().toISOString();
  const response = await fetch(url, { signal: signal ?? null, headers: { accept: "application/vnd.sdmx.data+json;version=2.0.0" } });
  if (!response.ok) throw new Error("BIS HTTP " + response.status);
  const rows = parseBIS((await response.json()) as Sdmx, geos);
  const out: EvidenceObservation[] = [];
  for (const r of rows) {
    const observedAt = quarterStart(r.period);
    if (!observedAt) continue;
    out.push({
      id: `bis:${r.geo}:${r.measure}:${r.period}`,
      sourceId: "bis-rpp", sourceName: "BIS Residential Property Prices", sourceType: "official_statistical",
      sourceUrl: url, publisher: "Bank for International Settlements",
      geographyType: "country", geographyKey: r.geo,
      entityType: "series", entityKey: `residential_property_price_${r.measure || "unknown"}`,
      observedAt, publishedAt: null, retrievedAt, availableAt: retrievedAt,
      effectiveFrom: observedAt, effectiveTo: null, revision: 1,
      value: { value: r.value, period: r.period, measure: r.measure },
      unit: null, frequency: "quarterly", leadClass: "UNKNOWN",
      sourceReliability: 0.95, independenceGroup: "bis",
      contentHash: ["bis", "WS_SPP", r.geo, r.measure, r.period, String(r.value)].join("|"),
      isRevision: false, supersedesId: null,
      metadata: { ingestionMode: "live", pointInTimeMode: "conservative_retrieval_cutoff" },
      createdAt: retrievedAt,
    });
  }
  return out;
}
