import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const ARAD_ENDPOINT = "https://www.cnb.cz/aradb/api/v1/indicators";
const DEFAULT_SET_IDS = ["1045", "1119", "1132", "1035", "1028"];
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;

export type AradRow = {
  indicator: string;
  period: string | null;
  value: string | null;
  fields: Record<string, string>;
};

export type AradSyncResult = {
  fetched: number;
  inserted: number;
  skipped: number;
  retrievedAt: string;
  setIds: string[];
};

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && quoted && line[i + 1] === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell.trim());
  return cells;
}

export function parseAradCsv(text: string): AradRow[] {
  const cleaned = text.replace(/^\uFEFF/, "").trim();
  if (!cleaned) return [];
  const lines = cleaned.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const delimiter = (lines[0].match(/;/g) ?? []).length >= (lines[0].match(/,/g) ?? []).length ? ";" : ",";
  const headers = parseDelimitedLine(lines[0], delimiter).map((h, i) => h || `column_${i + 1}`);
  const normalized = headers.map((h) => h.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase());
  const periodIndex = normalized.findIndex((h) => /^(obdobi|datum|date|period|cas|time|mesic|rok)$/.test(h) || /reference.?period|observation.?date/.test(h));
  const valueIndex = normalized.findIndex((h) => /^(hodnota|value|hodnoty|obs_value|observed_value|amount|sazba)$/.test(h) || /(^|_)value($|_)/.test(h));
  const indicatorIndex = normalized.findIndex((h) => /^(ukazatel|indicator|nazev|name|serie|series|id|kod|code|casova rada)$/.test(h) || /indicator.?name|series.?name/.test(h));
  return lines.slice(1).map((line) => {
    const values = parseDelimitedLine(line, delimiter);
    const fields: Record<string, string> = {};
    headers.forEach((header, index) => { fields[header] = values[index] ?? ""; });
    const fallbackIndicator = values[0] || "unknown";
    return {
      indicator: values[indicatorIndex >= 0 ? indicatorIndex : 0] || fallbackIndicator,
      period: periodIndex >= 0 ? values[periodIndex] || null : null,
      value: valueIndex >= 0 ? values[valueIndex] || null : null,
      fields,
    };
  }).filter((row) => Object.values(row.fields).some(Boolean));
}

function parsePeriod(value: string | null): string | null {
  if (!value) return null;
  const v = value.trim();
  if (/^\d{4}$/.test(v)) return `${v}-01-01T00:00:00.000Z`;
  const month = v.match(/^(\d{4})[-/.](\d{1,2})$/);
  if (month) return new Date(Date.UTC(Number(month[1]), Number(month[2]) - 1, 1)).toISOString();
  const day = v.match(/^(\d{1,2})[.](\d{1,2})[.](\d{4})$/);
  if (day) return new Date(Date.UTC(Number(day[3]), Number(day[2]) - 1, Number(day[1]))).toISOString();
  const parsed = Date.parse(v);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function numericValue(value: string | null): number | null {
  if (value == null || !value.trim()) return null;
  const normalized = value.trim().replace(/\u00a0/g, "").replace(/\s/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Fetches and appends official ČNB ARAD observations; secrets stay server-side. */
export async function syncCnbArad(
  supabase: SupabaseClient<Database>,
  requestedSetIds: string[] = DEFAULT_SET_IDS,
): Promise<AradSyncResult> {
  const apiKey = process.env.CNB_ARAD_API_KEY;
  if (!apiKey) throw new Error("Chybí serverová proměnná CNB_ARAD_API_KEY.");
  const setIds = [...new Set(requestedSetIds)];
  if (!setIds.length || setIds.length > 10 || setIds.some((id) => !/^\d{1,8}$/.test(id))) {
    throw new Error("Neplatný výběr ARAD set_id.");
  }

  const url = new URL(ARAD_ENDPOINT);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("set_id", setIds.join(","));
  url.searchParams.set("lang", "cs");
  url.searchParams.set("delimiter", "semicolon");

  const response = await fetch(url, {
    headers: { Accept: "text/csv,text/plain;q=0.9,*/*;q=0.1", "User-Agent": "RealityInvestor/1.0 (CNB ARAD data ingestion)" },
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`ČNB ARAD vrátila HTTP ${response.status}.`);
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) throw new Error("Odpověď ARAD překročila limit 8 MB.");
  if (/json/i.test(contentType) && /^\s*[{[]/.test(text)) {
    throw new Error("ČNB ARAD vrátila JSON místo očekávaného exportu; data nebyla uložena.");
  }
  const rows = parseAradCsv(text);
  if (!rows.length) throw new Error("Export ČNB ARAD neobsahuje datové řádky.");
  const retrievedAt = new Date().toISOString();

  const { data: source, error: sourceError } = await supabase
    .from("reality_evidence_sources")
    .select("id,source_name,source_type,publisher,default_reliability,independence_group")
    .eq("source_name", "Czech National Bank")
    .eq("source_type", "official_statistical")
    .maybeSingle();
  if (sourceError) throw sourceError;
  if (!source) throw new Error("Zdroj ČNB chybí. Nejprve aplikuj migraci 0006_future_os_evidence_foundation.sql.");

  const observations = rows.flatMap((row, index) => {
    const period = parsePeriod(row.period);
    const numeric = numericValue(row.value);
    // Do not invent a period or coerce non-numeric values into measurements.
    if (numeric == null) return [];
    const indicatorKey = row.indicator.normalize("NFKC").trim().slice(0, 180) || `row-${index + 1}`;
    const content = JSON.stringify({ indicator: indicatorKey, period: row.period, value: numeric, fields: row.fields });
    const hash = createHash("sha256").update(content).digest("hex");
    const effectiveAt = period ?? retrievedAt;
    return [{
      source_id: source.id,
      source_url: url.origin + url.pathname,
      source_name: "Czech National Bank",
      source_type: "official_statistical",
      publisher: "Česká národní banka",
      geography_type: "country",
      geography_key: "CZ",
      entity_type: "cnb_arad_indicator",
      entity_key: indicatorKey,
      observed_at: period,
      published_at: null,
      retrieved_at: retrievedAt,
      available_at: retrievedAt,
      effective_from: period,
      revision: 1,
      value: { numeric, raw: row.value, fields: row.fields, indicator: row.indicator, period: row.period, setIds } as Database["public"]["Tables"]["reality_evidence"]["Insert"]["value"],
      unit: row.fields["Jednotka"] || row.fields["Unit"] || null,
      frequency: null,
      lead_class: "UNKNOWN" as const,
      source_reliability: Number(source.default_reliability ?? 0.98),
      independence_group: source.independence_group,
      content_hash: hash,
      is_revision: false,
      metadata: { adapter: "cnb-arad", endpoint: ARAD_ENDPOINT, setIds, periodRaw: row.period, importedAt: retrievedAt },
    }];
  });

  if (!observations.length) {
    throw new Error("Export byl načten, ale nebyla nalezena žádná bezpečně rozpoznatelná číselná hodnota. Nic nebylo uloženo.");
  }

  let inserted = 0;
  // Small batches limit payload size and make failure boundaries explicit.
  for (let i = 0; i < observations.length; i += 100) {
    const batch = observations.slice(i, i + 100);
    const { data, error } = await supabase.from("reality_evidence").upsert(batch, {
      onConflict: "source_id,geography_type,geography_key,entity_type,entity_key,revision,content_hash",
      ignoreDuplicates: true,
    }).select("id");
    if (error) throw error;
    inserted += data?.length ?? 0;
  }

  return { fetched: rows.length, inserted, skipped: rows.length - inserted, retrievedAt, setIds };
}
