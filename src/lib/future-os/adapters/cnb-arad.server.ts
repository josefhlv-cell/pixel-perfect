/**
 * ČNB ARAD adapter (server-only). Reads CNB_ARAD_API_KEY from the server environment; the key is
 * never logged, returned, or sent to the browser. Appends to public.reality_evidence (append-only).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { evidenceContentHash } from "../evidence-hash.server";
import { decodeBody, parseData, parseIndicators, type AradIndicatorMeta, type AradObservation } from "./cnb-arad";

const BASE = "https://www.cnb.cz/aradb/api/v1";
const MAX_BYTES = 8 * 1024 * 1024;
const ADAPTER_KEY = "cnb-arad";
export const DEFAULT_SET_IDS = "1045,1119,1132,1035,1028";

export class AradError extends Error {}

async function aradGet(path: "indicators" | "data", setId: string, apiKey: string): Promise<string> {
  const qs = new URLSearchParams({ api_key: apiKey, set_id: setId, lang: "cs", delimiter: "semicolon" });
  let res: Response;
  try {
    res = await fetch(`${BASE}/${path}?${qs}`, { signal: AbortSignal.timeout(30_000) });
  } catch {
    throw new AradError(`ČNB ARAD nedostupné (${path}, timeout/síť)`);
  }
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES) throw new AradError(`Odpověď ARAD je příliš velká (${path})`);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) throw new AradError(`Odpověď ARAD je příliš velká (${path})`);
  const text = decodeBody(buf, res.headers.get("content-type"));
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = JSON.parse(text) as { message?: { cs?: string } }; if (j.message?.cs) msg += ` – ${j.message.cs}`; } catch { /* not json */ }
    throw new AradError(`ČNB ARAD odmítlo požadavek (${path}): ${msg}`);
  }
  return text;
}

export interface AradImportResult {
  setId: string;
  retrievedAt: string;
  fetched: number;
  inserted: number;
  revised: number;
  skipped: number;
  unparsable: number;
  noPeriod: number;
}

/** Fetches one ARAD set and appends new/revised observations. Never updates or deletes rows. */
export async function importAradSet(setId: string): Promise<AradImportResult> {
  const apiKey = process.env["CNB_ARAD_API_KEY"];
  if (!apiKey) throw new AradError("Chybí serverový klíč CNB_ARAD_API_KEY.");
  const retrievedAt = new Date().toISOString();

  const [metaText, dataText] = await Promise.all([aradGet("indicators", setId, apiKey), aradGet("data", setId, apiKey)]);
  const meta = parseIndicators(metaText);
  const { rows, skipped: unparsable } = parseData(dataText);
  if (rows.length === 0) throw new AradError(`Sada ${setId}: nenalezeny žádné číselné hodnoty – nic neuloženo.`);

  const { data: adapter, error: aErr } = await supabaseAdmin.from("reality_source_adapters")
    .select("source_id,source_name,publisher,canonical_url,reliability,independence_group").eq("adapter_key", ADAPTER_KEY).single();
  if (aErr || !adapter?.source_id) throw new AradError("Adaptér cnb-arad není v registru zdrojů.");
  const { data: source } = await supabaseAdmin.from("reality_evidence_sources")
    .select("source_name,source_type,default_reliability,independence_group").eq("id", adapter.source_id).single();
  const sourceId = adapter.source_id;

  // Existing state for this source: identity → { maxRevision, latestId, hashes }
  const indicatorIds = [...new Set(rows.map((r) => r.indicatorId))];
  const existing = new Map<string, { rev: number; id: string; hashes: Set<string> }>();
  for (let i = 0; i < indicatorIds.length; i += 100) {
    const chunk = indicatorIds.slice(i, i + 100);
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabaseAdmin.from("reality_evidence")
        .select("id,entity_key,effective_from,revision,content_hash,metadata")
        .eq("source_id", sourceId).eq("entity_type", "macro_indicator").in("entity_key", chunk)
        .range(from, from + 999);
      if (error) throw new AradError("Čtení existující evidence selhalo.");
      for (const e of data ?? []) {
        const k = `${e.entity_key}|${e.effective_from ?? (e.metadata as { period_raw?: string } | null)?.period_raw ?? ""}`;
        const cur = existing.get(k) ?? { rev: 0, id: e.id, hashes: new Set<string>() };
        cur.hashes.add(e.content_hash);
        if (e.revision > cur.rev) { cur.rev = e.revision; cur.id = e.id; }
        existing.set(k, cur);
      }
      if ((data?.length ?? 0) < 1000) break;
    }
  }

  let skipped = 0, revised = 0, noPeriod = 0;
  const inserts: Record<string, unknown>[] = [];
  const seenBatch = new Set<string>();
  for (const r of rows) {
    const m: AradIndicatorMeta | undefined = meta.get(r.indicatorId);
    if (!r.period) noPeriod++;
    const periodIso = r.period?.iso ?? null;
    // Without a reliable period, rows are not stored: their identity would be ambiguous.
    if (!periodIso) { skipped++; continue; }
    const key = `${r.indicatorId}|${periodIso}`;
    if (seenBatch.has(key)) { skipped++; continue; }
    seenBatch.add(key);
    const value = { value: r.value, raw: r.valueRaw, snapshot_id: r.snapshotId };
    const hash = evidenceContentHash({ sourceId, geographyType: "country", geographyKey: "CZ", entityType: "macro_indicator", entityKey: r.indicatorId, revision: 0, value: { ...value, unit: m?.unit ?? null, mult: m?.unitMultCode ?? null } });
    const prev = existing.get(key);
    if (prev?.hashes.has(hash)) { skipped++; continue; }
    const revision = (prev?.rev ?? 0) + 1;
    if (revision > 1) revised++;
    inserts.push(buildRow(r, m, { sourceId, adapter, source, retrievedAt, setId, hash, revision, supersedes: prev?.id ?? null, periodIso }));
  }

  let inserted = 0;
  for (let i = 0; i < inserts.length; i += 500) {
    const { error } = await supabaseAdmin.from("reality_evidence").insert(inserts.slice(i, i + 500) as never);
    if (error) { console.error("[cnb-arad] insert failed", error.code, error.message); throw new AradError(`Uložení selhalo po ${inserted} řádcích.`); }
    inserted += Math.min(500, inserts.length - i);
  }
  return { setId, retrievedAt, fetched: rows.length, inserted, revised, skipped, unparsable, noPeriod };
}

function buildRow(
  r: AradObservation, m: AradIndicatorMeta | undefined,
  c: { sourceId: string; adapter: { source_name: string; publisher: string | null; canonical_url: string | null; reliability: number | null; independence_group: string };
       source: { source_name: string; source_type: string; default_reliability: number; independence_group: string } | null;
       retrievedAt: string; setId: string; hash: string; revision: number; supersedes: string | null; periodIso: string },
) {
  return {
    source_id: c.sourceId,
    source_url: `${BASE}/data?set_id=${c.setId}`, // no api_key in stored URL
    source_name: c.source?.source_name ?? c.adapter.source_name,
    source_type: c.source?.source_type ?? "official_statistical",
    publisher: c.adapter.publisher ?? "Česká národní banka",
    geography_type: "country",
    geography_key: "CZ",
    entity_type: "macro_indicator",
    entity_key: r.indicatorId,
    observed_at: c.periodIso,          // ARAD period date (period-end reference date)
    published_at: null,                 // ARAD exposes no publication timestamp → never invented
    retrieved_at: c.retrievedAt,
    available_at: c.retrievedAt,        // information availability = our retrieval time
    effective_from: c.periodIso,
    effective_to: null,
    revision: c.revision,
    value: { value: r.value, raw: r.valueRaw, snapshot_id: r.snapshotId },
    unit: m?.unit ?? null,
    frequency: m?.frequencyCode ?? null, // provider-declared, not inferred
    lead_class: "UNKNOWN",              // classification is a later, evidence-based step
    source_reliability: c.source?.default_reliability ?? c.adapter.reliability ?? 0.5,
    independence_group: c.source?.independence_group ?? c.adapter.independence_group,
    content_hash: c.hash,
    is_revision: c.revision > 1,
    supersedes_id: c.supersedes,
    metadata: {
      adapterKey: ADAPTER_KEY, ingestionMode: "server_append_only", set_id: c.setId,
      period_raw: r.periodRaw, period_granularity: r.period?.granularity ?? null, period_semantics: "arad_period_date",
      indicator_name: m?.name ?? null, frequency_name: m?.frequencyName ?? null,
      unit_mult_code: m?.unitMultCode ?? null, unit_mult_name: m?.unitMultName ?? null,
      original_data_row: r.original, original_indicator_row: m?.original ?? null,
    },
  };
}
