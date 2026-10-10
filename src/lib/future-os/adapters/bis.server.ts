import type { EvidenceObservation } from "../types";

const BIS_BASE = "https://stats.bis.org/api/v2/data/dataflow/BIS/WS_SPP/1.0";
const BIS_MEASURES = ["N", "R"] as const;

type Dimension = { id: string; values: Array<{ id: string; name?: string }> };
type Sdmx = {
  data?: {
    structure?: { dimensions?: { series?: Dimension[]; observation?: Dimension[] } };
    dataSets?: Array<{ series?: Record<string, { observations?: Record<string, number[]> }> }>;
  };
  meta?: { prepared?: string };
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
  const measureIndex = seriesDimensions.findIndex((d) => ["VALUE_MEASURE", "MEASURE", "INDICATOR"].includes(d.id));
  const frequencyIndex = seriesDimensions.findIndex((d) => d.id === "FREQ");
  const rows: Array<{ geo: string; measure: string; period: string; value: number }> = [];

  for (const [seriesKey, seriesData] of Object.entries(rawSeries)) {
    const indices = seriesKey.split(":").map(Number);
    const geo = seriesDimensions[geoIndex]?.values[indices[geoIndex] ?? -1]?.id;
    const measure = measureIndex >= 0 ? seriesDimensions[measureIndex]?.values[indices[measureIndex] ?? -1]?.id ?? "" : "";
    const frequency = frequencyIndex >= 0 ? seriesDimensions[frequencyIndex]?.values[indices[frequencyIndex] ?? -1]?.id : "Q";
    if (!geo || (requestedGeos.length && !requestedGeos.includes(geo)) || frequency !== "Q") continue;
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
 * Fetch quarterly BIS residential property-price series. BIS supplies current
 * SDMX values; we record retrieval time and deliberately do not claim historic
 * source-published vintages or a verified publication timestamp.
 */
export async function fetchBisResidentialPropertyPrices(
  geos: string[] = ["CZ"],
  signal?: AbortSignal,
): Promise<EvidenceObservation[]> {
  const measures = [...BIS_MEASURES];
  const key = "Q." + geos.join("+") + "." + measures.join("+") + ".628";
  const url = new URL(`${BIS_BASE}/${key}`);
  url.searchParams.set("format", "sdmx-json");
  url.searchParams.set("detail", "dataonly");
  url.searchParams.set("startPeriod", "2000-Q1");
  const retrievedAt = new Date().toISOString();
  const response = await fetch(url, {
    signal,
    headers: {
      accept: "application/vnd.sdmx.data+json;version=2",
    },
  });
  if (!response.ok) throw new Error(`BIS residential property prices HTTP ${response.status}`);
  const dataset = await response.json() as Sdmx;
  const rows = parseBIS(dataset, geos);
  if (!rows.length) throw new Error("BIS returned no usable quarterly residential property-price observations.");

  return rows.map((row): EvidenceObservation => {
    const observedAt = quarterStart(row.period);
    const contentHash = [ "bis", "WS_SPP", row.geo, row.measure, row.period, String(row.value) ].join("|");
    return {
      id: `bis:WS_SPP:${row.geo}:${row.measure}:${row.period}`,
      sourceId: "bis-ws-spp",
      sourceName: "BIS Residential Property Prices",
      sourceType: "official_statistical",
      sourceUrl: url.toString(),
      publisher: "Bank for International Settlements",
      geographyType: "country",
      geographyKey: row.geo,
      entityType: "series",
      entityKey: `residential_property_price:${row.measure}`,
      observedAt,
      publishedAt: null,
      retrievedAt,
      availableAt: retrievedAt,
      effectiveFrom: observedAt,
      effectiveTo: null,
      revision: 1,
      value: { value: row.value, period: row.period, geo: row.geo, measure: row.measure, dataset: "WS_SPP" },
      unit: "source-defined-index",
      frequency: "quarterly",
      leadClass: "LAGGING",
      sourceReliability: 0.97,
      independenceGroup: "bis",
      contentHash,
      isRevision: false,
      supersedesId: null,
      metadata: {
        ingestionMode: "live",
        pointInTimeMode: "conservative_retrieval_cutoff",
        sourcePreparedAt: dataset.meta?.prepared ?? null,
        quality: "RETRIEVAL_SNAPSHOT",
        caveat: "Current BIS API values are retrieval snapshots, not archived source-published vintages.",
      },
      createdAt: retrievedAt,
    };
  });
}
