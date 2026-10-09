/**
 * ČNB ARAD — pure parsing helpers (no network, no secrets). Used by cnb-arad.server.ts and tests.
 *
 * Observed real response shape (2026-10):
 *   GET /aradb/api/v1/indicators → indicator_id;indicator_name;frequency_code;frequency_name;unit_mult_code;unit_mult_name;unit
 *   GET /aradb/api/v1/data       → indicator_id;snapshot_id;period;value   (period = YYYYMMDD period-end date, decimal comma)
 * Body is served as windows-1250 (header says EE8MSWIN1250).
 *
 * Point-in-time rule: ARAD does not expose a publication timestamp, so published_at stays NULL and
 * available_at = retrieved_at = import time. A historical query before the import never sees these rows.
 */

// windows-1250 code points for bytes 0x80..0xFF (undefined bytes map to U+FFFD).
const CP1250_HIGH =
  "€\uFFFD‚\uFFFD„…†‡\uFFFD‰Š‹ŚŤŽŹ\uFFFD‘’“”•–—\uFFFD™š›śťžź" +
  "\u00A0ˇ˘Ł¤Ą¦§¨©Ş«¬\u00AD®Ż°±˛ł´µ¶·¸ąş»Ľ˝ľż" +
  "ŔÁÂĂÄĹĆÇČÉĘËĚÍÎĎĐŃŇÓÔŐÖ×ŘŮÚŰÜÝŢßŕáâăäĺćçčéęëěíîďđńňóôőö÷řůúűüýţ˙";

export function decodeBody(bytes: Uint8Array, contentType: string | null): string {
  const ct = (contentType ?? "").toLowerCase();
  let text: string;
  if (/utf-?8/.test(ct)) text = new TextDecoder("utf-8").decode(bytes);
  else {
    let out = "";
    for (const b of bytes) out += b < 0x80 ? String.fromCharCode(b) : CP1250_HIGH[b - 0x80];
    text = out;
  }
  return text.replace(/^\uFEFF/, "");
}

/** RFC4180-style parser with configurable delimiter; handles quotes, escaped quotes, CRLF, BOM. */
export function parseDelimited(text: string, delimiter = ";"): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

const HEADER_ALIASES: Record<string, string[]> = {
  indicator_id: ["indicator_id", "id_ukazatele", "kod_ukazatele", "ukazatel_id", "indicator"],
  indicator_name: ["indicator_name", "nazev_ukazatele", "nazev", "name"],
  frequency_code: ["frequency_code", "frekvence_kod", "frequency"],
  frequency_name: ["frequency_name", "frekvence"],
  unit_mult_code: ["unit_mult_code"],
  unit_mult_name: ["unit_mult_name", "nasobek"],
  unit: ["unit", "jednotka"],
  snapshot_id: ["snapshot_id"],
  period: ["period", "obdobi", "datum", "date"],
  value: ["value", "hodnota"],
};

function normHeader(h: string) {
  return h.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s-]+/g, "_");
}

/** Rows as objects keyed by canonical names; `original` keeps every provider field verbatim. */
export function toRecords(table: string[][]): { canonical: Record<string, string>; original: Record<string, string> }[] {
  const [header, ...body] = table;
  if (!header) return [];
  const keys = header.map((h) => {
    const n = normHeader(h);
    return Object.entries(HEADER_ALIASES).find(([, al]) => al.includes(n))?.[0] ?? null;
  });
  return body.map((r) => {
    const canonical: Record<string, string> = {};
    const original: Record<string, string> = {};
    header.forEach((h, i) => {
      const v = (r[i] ?? "").trim();
      original[h.trim()] = v;
      const k = keys[i];
      if (k && !(k in canonical)) canonical[k] = v;
    });
    return { canonical, original };
  });
}

/** Czech/English number: "7400185680,8", "1 234,5", "-0.25". Returns null when not a clean number. */
export function parseNumber(raw: string | undefined | null): number | null {
  if (raw == null) return null;
  let s = raw.trim().replace(/[\s\u00A0]/g, "");
  if (!s) return null;
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(",", ".");
  if (!/^[-+]?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Only unambiguous formats are accepted; anything else → null (no guessed dates). */
export function parsePeriod(raw: string | undefined | null): { iso: string; granularity: "day" | "month" | "year" } | null {
  const s = (raw ?? "").trim();
  let y: number, m = 1, d = 1, g: "day" | "month" | "year";
  let mt: RegExpMatchArray | null;
  if ((mt = /^(\d{4})(\d{2})(\d{2})$/.exec(s)) || (mt = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s))) {
    y = +mt[1]!; m = +mt[2]!; d = +mt[3]!; g = "day";
  } else if ((mt = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s))) {
    d = +mt[1]!; m = +mt[2]!; y = +mt[3]!; g = "day";
  } else if ((mt = /^(\d{4})-?(\d{2})$/.exec(s))) {
    y = +mt[1]!; m = +mt[2]!; g = "month";
  } else if ((mt = /^(\d{4})$/.exec(s))) {
    y = +mt[1]!; g = "year";
  } else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d || y < 1900 || y > 2200) return null;
  return { iso: dt.toISOString(), granularity: g };
}

export interface AradIndicatorMeta {
  indicatorId: string;
  name: string | null;
  frequencyCode: string | null;
  frequencyName: string | null;
  unit: string | null;
  unitMultCode: string | null;
  unitMultName: string | null;
  original: Record<string, string>;
}

export interface AradObservation {
  indicatorId: string;
  snapshotId: string | null;
  periodRaw: string;
  period: { iso: string; granularity: "day" | "month" | "year" } | null;
  value: number;
  valueRaw: string;
  original: Record<string, string>;
}

export function parseIndicators(text: string): Map<string, AradIndicatorMeta> {
  const out = new Map<string, AradIndicatorMeta>();
  for (const { canonical: c, original } of toRecords(parseDelimited(text))) {
    if (!c.indicator_id) continue;
    out.set(c.indicator_id, {
      indicatorId: c.indicator_id, name: c.indicator_name || null,
      frequencyCode: c.frequency_code || null, frequencyName: c.frequency_name || null,
      unit: c.unit || null, unitMultCode: c.unit_mult_code || null, unitMultName: c.unit_mult_name || null, original,
    });
  }
  return out;
}

export function parseData(text: string): { rows: AradObservation[]; skipped: number } {
  const rows: AradObservation[] = [];
  let skipped = 0;
  for (const { canonical: c, original } of toRecords(parseDelimited(text))) {
    const value = parseNumber(c.value);
    if (!c.indicator_id || value == null) { skipped++; continue; }
    rows.push({
      indicatorId: c.indicator_id, snapshotId: c.snapshot_id || null,
      periodRaw: c.period ?? "", period: parsePeriod(c.period), value, valueRaw: c.value ?? "", original,
    });
  }
  return { rows, skipped };
}
