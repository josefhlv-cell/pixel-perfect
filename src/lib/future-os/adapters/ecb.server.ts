import type { EvidenceObservation } from "../types";

const ECB_API = "https://data-api.ecb.europa.eu/service/data/IRS/M.CZ.L.L40.CI.0000.CZK.N.Z";

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && quoted && line[i + 1] === '"') {
      field += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      fields.push(field);
      field = "";
    } else {
      field += char;
    }
  }
  fields.push(field);
  return fields;
}

/**
 * Fetch Czech 10-year government bond yield from the ECB Data Portal's
 * Interest Rate Statistics (IRS) dataflow. Values are monthly percent-per-year
 * observations. Retrieval time is recorded separately from the observation
 * period; this is not a historical publisher-vintage reconstruction.
 */
export async function fetchEcbCzechLongTermRates(signal?: AbortSignal): Promise<EvidenceObservation[]> {
  const url = new URL(ECB_API);
  url.searchParams.set("startPeriod", "2001-01");
  url.searchParams.set("detail", "dataonly");
  url.searchParams.set("format", "csvdata");
  const response = await fetch(url, { signal, headers: { accept: "text/csv" } });
  if (!response.ok) throw new Error(`ECB long-term interest rates HTTP ${response.status}`);
  const csv = await response.text();
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error("ECB returned no Czech long-term interest-rate observations.");
  const header = parseCsvLine(lines[0]);
  const periodIndex = header.indexOf("TIME_PERIOD");
  const valueIndex = header.indexOf("OBS_VALUE");
  if (periodIndex < 0 || valueIndex < 0) throw new Error("ECB CSV response is missing TIME_PERIOD or OBS_VALUE.");

  const retrievedAt = new Date().toISOString();
  const rows = lines.slice(1).map(parseCsvLine).flatMap((row) => {
    const period = row[periodIndex];
    const rawValue = row[valueIndex]?.trim();
    const value = rawValue ? Number(rawValue) : Number.NaN;
    if (!/^\d{4}-\d{2}$/.test(period ?? "") || !Number.isFinite(value)) return [];
    return [{ period, value }];
  });
  if (!rows.length) throw new Error("ECB returned no usable Czech long-term interest-rate observations.");

  return rows.map(({ period, value }): EvidenceObservation => {
    const observedAt = `${period}-01T00:00:00.000Z`;
    return {
      id: `ecb-irs:CZ:10Y:${period}`,
      sourceId: "ecb-irs-cz-10y",
      sourceName: "ECB Czech Long-Term Interest Rate",
      sourceType: "official_statistical",
      sourceUrl: url.toString(),
      publisher: "European Central Bank",
      geographyType: "country",
      geographyKey: "CZ",
      entityType: "series",
      entityKey: "government_bond_yield_10y",
      observedAt,
      publishedAt: null,
      retrievedAt,
      availableAt: retrievedAt,
      effectiveFrom: observedAt,
      effectiveTo: null,
      revision: 1,
      value: { value, period, measure: "10-year government bond yield" },
      unit: "percent_per_annum",
      frequency: "monthly",
      leadClass: "COINCIDENT",
      sourceReliability: 0.99,
      independenceGroup: "ecb",
      contentHash: ["ecb-irs-cz-10y", period, String(value)].join("|"),
      isRevision: false,
      supersedesId: null,
      metadata: {
        ingestionMode: "live",
        pointInTimeMode: "conservative_retrieval_cutoff",
        quality: "RETRIEVAL_SNAPSHOT",
        caveat: "Current ECB API values are retrieval snapshots, not archived source-published vintages.",
      },
      createdAt: retrievedAt,
    };
  });
}
