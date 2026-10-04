/** Web Agent — pure helpers (testable, no I/O). Web content is UNTRUSTED. */

export interface ExtractedListing {
  source_url: string;
  source_domain: string;
  title: string | null;
  price: number | null;
  currency: string | null;
  location: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  property_type: string | null;
  rooms: string | null;
  area_m2: number | null;
  condition: string | null;
  floor: number | null;
  ownership: string | null;
  balcony: boolean | null;
  terrace: boolean | null;
  parking: boolean | null;
  elevator: boolean | null;
  description: string | null;
  published_at: string | null;
  updated_at: string | null;
  statusMarker: "SOLD" | "RESERVED" | null;
  is_listing_detail: boolean;
}

export const LIVE_SOURCE_TYPE = "LIVE";

/** Canonical URL: lowercase host, no www, no hash, no tracking params, no trailing slash. */
export function canonicalUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    u.hash = "";
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ref$|source$)/i.test(k)) u.searchParams.delete(k);
    let s = u.toString();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s;
  } catch {
    return null;
  }
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Collect unique http(s) URLs from free text + citations. */
export function collectUrls(text: string, citations: string[] = []): string[] {
  const found = [...citations, ...(text.match(/https?:\/\/[^\s"'<>)\]]+/g) ?? [])];
  const out = new Set<string>();
  for (const f of found) {
    const c = canonicalUrl(f.replace(/[.,;]+$/, ""));
    if (c) out.add(c);
  }
  return [...out];
}

/** Strip HTML to readable text; keeps JSON-LD and meta tags (often hold price/area). */
export function htmlToText(html: string, max = 14000): string {
  const ld = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join("\n");
  const meta = [...html.matchAll(/<meta[^>]+(?:property|name)=["'](og:[^"']+|description)["'][^>]*content=["']([^"']*)["']/gi)]
    .map((m) => `${m[1]}: ${m[2]}`)
    .join("\n");
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return `${meta}\n${ld.slice(0, 4000)}\n${body}`.slice(0, max);
}

const num = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[\s\u00a0]/g, "").replace(",", "."));
    return Number.isFinite(n) && v.trim() !== "" ? n : null;
  }
  return null;
};
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, 4000) : null);
const bool = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);

/** Normalize model output. Missing / invalid → null. Never invents values. */
export function normalizeExtraction(j: Record<string, unknown>, url: string): ExtractedListing {
  const price = num(j["price"]);
  const area = num(j["area_m2"]);
  const lat = num(j["latitude"]);
  const lng = num(j["longitude"]);
  const floor = num(j["floor"]);
  const rooms = str(j["rooms"])?.replace(/\s+/g, "").toLowerCase() ?? null;
  return {
    source_url: url,
    source_domain: domainOf(url),
    title: str(j["title"]),
    price: price != null && price > 50_000 && price < 1_000_000_000 ? Math.round(price) : null,
    currency: str(j["currency"]) ?? (price != null ? "CZK" : null),
    location: str(j["location"]),
    address: str(j["address"]),
    latitude: lat != null && lat > 47 && lat < 52 ? lat : null,
    longitude: lng != null && lng > 11 && lng < 20 ? lng : null,
    property_type: (() => {
      const t = str(j["property_type"])?.toLowerCase();
      return t === "byt" || t === "dum" ? t : t ? t : null;
    })(),
    rooms,
    area_m2: area != null && area > 5 && area < 2000 ? area : null,
    condition: str(j["condition"]),
    floor: floor != null && Number.isInteger(floor) ? floor : null,
    ownership: str(j["ownership"]),
    balcony: bool(j["balcony"]),
    terrace: bool(j["terrace"]),
    parking: bool(j["parking"]),
    elevator: bool(j["elevator"]),
    description: str(j["description"]),
    published_at: validDate(j["published_at"]),
    updated_at: validDate(j["updated_at"]),
    statusMarker: j["statusMarker"] === "SOLD" || j["statusMarker"] === "RESERVED" ? j["statusMarker"] : null,
    is_listing_detail: j["is_listing_detail"] === true,
  };
}

function validDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** A listing is usable only if it is a single-offer detail page with a real price. */
export function isUsable(e: ExtractedListing): boolean {
  return e.is_listing_detail && e.price != null;
}

/** Parse a free-text investor query into coarse filters (UI hints only). */
export function parseQuery(q: string): { rooms: string | null; maxPrice: number | null; minYieldPct: number | null } {
  const rooms = q.match(/\b(\d\+(?:kk|\d))\b/i)?.[1]?.toLowerCase() ?? null;
  const pm = q.match(/do\s+([\d\s\u00a0.,]+)\s*(mil|m|kč|czk)?/i);
  let maxPrice: number | null = null;
  if (pm) {
    const n = Number(pm[1]!.replace(/[\s\u00a0.]/g, "").replace(",", "."));
    if (Number.isFinite(n) && n > 0) maxPrice = /mil|^m$/i.test(pm[2] ?? "") ? n * 1_000_000 : n;
  }
  const y = q.match(/(\d+(?:[.,]\d+)?)\s*%/);
  const minYieldPct = y ? Number(y[1]!.replace(",", ".")) : null;
  return { rooms, maxPrice, minYieldPct };
}
