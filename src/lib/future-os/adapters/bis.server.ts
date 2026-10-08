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
