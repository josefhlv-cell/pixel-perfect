import type { EvidenceObservation, LeadClass } from "../types";

const EUROSTAT_BASE = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data";

type JsonStat = {
  id?: string[];
  size?: number[];
  dimension?: Record<string, {
    category?: {
      index?: Record<string, number>;
      label?: Record<string, string>;
    };
  }>;
  value?: Record<string, number> | number[];
  updated?: string;
  label?: string;
};

function valueAt(dataset: JsonStat, flatIndex: number): number | null {
  if (Array.isArray(dataset.value)) return dataset.value[flatIndex] ?? null;
  return dataset.value?.[String(flatIndex)] ?? null;
}

function cartesianIndices(size: number[]) {
  const out: number[][] = [];
  const walk = (prefix: number[]) => {
    if (prefix.length === size.length) { out.push(prefix); return; }
    const dimension = size[prefix.length] ?? 0;
    for (let i = 0; i < dimension; i++) walk([...prefix, i]);
  };
  walk([]);
  return out;
}

function flatIndex(indices: number[], size: number[]) {
  let result = 0;
  for (let i = 0; i < indices.length; i++) {
    let stride = 1;
    for (let j = i + 1; j < size.length; j++) stride *= size[j] ?? 1;
    result += (indices[i] ?? 0) * stride;
  }
  return result;
}

function dimensionCode(dataset: JsonStat, dimension: string, position: number) {
  const index = dataset.dimension?.[dimension]?.category?.index ?? {};
  return Object.entries(index).find(([, value]) => value === position)?.[0] ?? null;
}

function quarterStart(period: string): string | null {
  const match = /^(\d{4})-Q([1-4])$/.exec(period);
  if (!match) return null;
  return `${match[1]}-${String((Number(match[2]) - 1) * 3 + 1).padStart(2, "0")}-01T00:00:00.000Z`;
}

export async function fetchEurostatHousePriceIndex(
  geos: string[] = ["CZ"],
  signal?: AbortSignal,
): Promise<EvidenceObservation[]> {
  const url = new URL(`${EUROSTAT_BASE}/prc_hpi_q`);
  url.searchParams.set("format", "JSON");
  url.searchParams.set("lang", "EN");
  url.searchParams.set("purchase", "TOTAL");
  url.searchParams.set("unit", "I15_Q");
  for (const geo of geos) url.searchParams.append("geo", geo);

  const retrievedAt = new Date().toISOString();
  const response = await fetch(url.toString(), {
    signal,
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Eurostat HTTP ${response.status}`);
  const dataset = await response.json() as JsonStat;
  const ids = dataset.id ?? [];
  const size = dataset.size ?? [];
  const timeDimension = ids.indexOf("time");
  const geoDimension = ids.indexOf("geo");
  if (timeDimension < 0 || geoDimension < 0) throw new Error("Eurostat response is missing time/geo dimensions.");

  const observations: EvidenceObservation[] = [];
  for (const positions of cartesianIndices(size)) {
    const value = valueAt(dataset, flatIndex(positions, size));
    if (value == null || !Number.isFinite(value)) continue;
    const period = dimensionCode(dataset, "time", positions[timeDimension] ?? -1);
    const geo = dimensionCode(dataset, "geo", positions[geoDimension] ?? -1);
    const observedAt = period ? quarterStart(period) : null;
    if (!geo || !observedAt) continue;

    const contentHash = [
      "eurostat","prc_hpi_q","TOTAL","I15_Q",geo,period,String(value)
    ].join("|");

    observations.push({
      id: `eurostat:${geo}:${period}`,
      sourceId: "eurostat-prc-hpi-q",
      sourceName: "Eurostat prc_hpi_q",
      sourceType: "official_statistical",
      sourceUrl: url.toString(),
      publisher: "Eurostat",
      geographyType: "country",
      geographyKey: geo,
      entityType: "series",
      entityKey: "house_price_index_total_2015",
      observedAt,
      publishedAt: null,
      retrievedAt,
      availableAt: retrievedAt,
      effectiveFrom: observedAt,
      effectiveTo: null,
      revision: 1,
      value: { value, period, geo, unit: "I15_Q", purchase: "TOTAL", dataset: "prc_hpi_q", sourceUpdated: dataset.updated ?? null },
      unit: "index_2015_100",
      frequency: "quarterly",
      leadClass: "LAGGING" as LeadClass,
      sourceReliability: 0.97,
      independenceGroup: "eurostat",
      contentHash,
      isRevision: false,
      supersedesId: null,
      metadata: {
        ingestionMode: "live",
        pointInTimeMode: "conservative_retrieval_cutoff",
        eurostatDatasetUpdatedAt: dataset.updated ?? null,
      },
      createdAt: retrievedAt,
    });
  }
  return observations;
}
