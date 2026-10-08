import type { EvidenceObservation } from "../types";

const BIS_BASE = "https://stats.bis.org/api/v2/data/dataflow/BIS/WS_SPP/1.0";

type Dimension = { id: string; values: Array<{ id: string; name?: string }> };
type Sdmx = {
  structure?: { dimensions?: { observation?: Dimension[] } };
  data?: { dataSets?: Array<{ observations?: Record<string, number[]> }> };
};

function quarterStart(period: string): string | null {
  const m = /^(\d{4})-Q([1-4])$/.exec(period);
  return m ? m[1] + "-" + String((Number(m[2]) - 1) * 3 + 1).padStart(2, "0") + "-01T00:00:00.000Z" : null;
}

function parseBIS(dataset: Sdmx, requestedGeos: string[]) {
  const dimensions = dataset.structure?.dimensions?.observation ?? [];
  const observations = dataset.data?.dataSets?.[0]?.observations ?? {};
  const values = dimensions.map((d) => d.values);
  const timeIndex = dimensions.findIndex((d) => d.id === "TIME_PERIOD");
  const geoIndex = dimensions.findIndex((d) => d.id === "REF_AREA");
  const measureIndex = dimensions.findIndex((d) => d.id === "VALUE_MEASURE");
  if (timeIndex < 0 || geoIndex < 0) return [];
  const rows: Array<{ geo: string; measure: string; period: string; value: number }> = [];
  for (const [key, payload] of Object.entries(observations)) {
    const indices = key.split(":").map(Number);
    const geo = values[geoIndex]?.[indices[geoIndex] ?? -1]?.id;
    const period = values[timeIndex]?.[indices[timeIndex] ?? -1]?.id;
    const measure = measureIndex >= 0 ? values[measureIndex]?.[indices[measureIndex] ?? -1]?.id ?? "" : "";
    const value = payload[0];
    if (!geo || !period || typeof value !== "number" || !Number.isFinite(value)) continue;
    if (requestedGeos.length && !requestedGeos.includes(geo)) continue;
    rows.push({ geo, measure, period, value });
  }
  return rows;
}

export async function fetchBisResidentialPropertyPrices(
  geos: string[] = ["CZ"],
  measures: Array<"N" | "R"> = ["N", "R"],
  startPeriod = "2000-Q1",
  signal?: AbortSignal,
): Promise<EvidenceObservation[]> {
  const retrievedAt = new Date().toISOString();
  const key = "Q." + geos.join("+") + "." + measures.join("+") + ".628";
  const url = new URL(BIS_BASE + "/" + key);
  url.searchParams.set("startPeriod", startPeriod);
  url.searchParams.set("detail", "dataonly");
  url.searchParams.set("format", "jsondata");

  const response = await fetch(url, {
    signal,
    headers: { Accept: "application/vnd.sdmx.data+json" },
  });
  if (!response.ok) throw new Error("BIS HTTP " + response.status);
  const dataset = await response.json() as Sdmx;
  const rows = parseBIS(dataset, geos);

  return rows.flatMap((row) => {
    const effectiveFrom = quarterStart(row.period);
    if (!effectiveFrom) return [];
    const real = row.measure === "R";
    return [{
      id: "bis:rpp:" + row.geo + ":" + row.measure + ":" + row.period,
      sourceId: "bis-rpp",
      sourceName: "BIS Selected Residential Property Prices",
      sourceType: "official_statistical",
      sourceUrl: url.toString(),
      publisher: "Bank for International Settlements",
      geographyType: "country",
      geographyKey: row.geo,
      entityType: "series",
      entityKey: real ? "residential_price_index_real_2010" : "residential_price_index_nominal_2010",
      observedAt: effectiveFrom,
      publishedAt: null,
      retrievedAt,
      availableAt: retrievedAt,
      effectiveFrom,
      effectiveTo: null,
      revision: 1,
      value: row.value,
      unit: "index_2010_100",
      frequency: "quarterly",
      leadClass: "LAGGING",
      sourceReliability: 0.99,
      independenceGroup: "bis",
      contentHash: ["bis","WS_SPP",row.geo,row.measure,row.period,row.value].join("|"),
      isRevision: false,
      supersedesId: null,
      metadata: { dataflow: "WS_SPP", measure: row.measure, period: row.period, pointInTimeMode: "conservative_retrieval_cutoff" },
      createdAt: retrievedAt,
    } satisfies EvidenceObservation];
  });
}
