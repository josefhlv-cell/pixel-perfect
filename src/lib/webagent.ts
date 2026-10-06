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

// ---------------------------------------------------------------------------
// Location / rooms / geo helpers used by Deal Hunter filters
// ---------------------------------------------------------------------------

/** Normalize Czech city names for matching (lowercase, strip diacritics, common suffixes). */
export function normalizeLocation(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s*[-–—]\s*.+$/, "") // "Pardubice - centrum" → "pardubice"
    .replace(/\s+(mesto|obec|mestska cast|okres)\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when listing city matches the user location filter. */
export function locationMatches(listingCity: string | null | undefined, filter: string): boolean {
  if (!filter.trim()) return true;
  if (!listingCity) return false;
  const a = normalizeLocation(listingCity);
  const b = normalizeLocation(filter);
  if (!a || !b) return false;
  return a === b || a.startsWith(b + " ") || a.includes(b) || b.includes(a);
}

/** Normalize disposition string ("2 + kk" → "2+kk"). */
export function normalizeRooms(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/\s+/g, "").toLowerCase();
}

/** Exact-ish rooms match: "2+kk" matches "2+kk" / "2+KK", not "12+kk". */
export function roomsMatch(listingRooms: string | null | undefined, filter: string): boolean {
  if (!filter.trim()) return true;
  const a = normalizeRooms(listingRooms);
  const b = normalizeRooms(filter);
  if (!a || !b) return false;
  return a === b || a.startsWith(b) || b.startsWith(a);
}

/** Haversine distance in km between two WGS84 points. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Approximate city centroids for common Czech cities (used when radius filter is set but listing has no coords). */
const CITY_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  praha: { lat: 50.0755, lng: 14.4378 },
  brno: { lat: 49.1951, lng: 16.6068 },
  ostrava: { lat: 49.8209, lng: 18.2625 },
  plzen: { lat: 49.7465, lng: 13.3775 },
  liberec: { lat: 50.7663, lng: 15.0543 },
  olomouc: { lat: 49.5938, lng: 17.2509 },
  usti: { lat: 50.6607, lng: 14.0323 },
  "usti nad labem": { lat: 50.6607, lng: 14.0323 },
  hradec: { lat: 50.2104, lng: 15.8252 },
  "hradec kralove": { lat: 50.2104, lng: 15.8252 },
  ceske: { lat: 48.9745, lng: 14.4747 },
  "ceske budejovice": { lat: 48.9745, lng: 14.4747 },
  pardubice: { lat: 50.0343, lng: 15.7812 },
  zlin: { lat: 49.2265, lng: 17.6707 },
  havirov: { lat: 49.7798, lng: 18.4369 },
  kladno: { lat: 50.1473, lng: 14.1029 },
  most: { lat: 50.503, lng: 13.636 },
  opava: { lat: 49.9387, lng: 17.9026 },
  frydek: { lat: 49.6853, lng: 18.3506 },
  "frydek mistek": { lat: 49.6853, lng: 18.3506 },
  karvina: { lat: 49.854, lng: 18.5417 },
  jihlava: { lat: 49.3961, lng: 15.5912 },
  teplice: { lat: 50.6404, lng: 13.8245 },
  decin: { lat: 50.7822, lng: 14.2148 },
  chomutov: { lat: 50.4605, lng: 13.4178 },
  prerov: { lat: 49.4551, lng: 17.4509 },
  jablonec: { lat: 50.7245, lng: 15.1711 },
  mlada: { lat: 50.4114, lng: 14.9033 },
  "mlada boleslav": { lat: 50.4114, lng: 14.9033 },
  prostejov: { lat: 49.472, lng: 17.1118 },
  trinec: { lat: 49.6776, lng: 18.6708 },
  ceska: { lat: 50.759, lng: 15.051 },
  "ceska lipa": { lat: 50.6855, lng: 14.5376 },
  tabor: { lat: 49.4144, lng: 14.6578 },
  znojmo: { lat: 48.8555, lng: 16.0488 },
  pribram: { lat: 49.6899, lng: 14.0104 },
  kolin: { lat: 50.028, lng: 15.200 },
};

export function cityCentroid(city: string | null | undefined): { lat: number; lng: number } | null {
  if (!city) return null;
  const key = normalizeLocation(city);
  return CITY_CENTROIDS[key] ?? null;
}

/** From a search-results page, pick links that look like single-listing detail pages on the same site. */
export function detailLinksFrom(pageUrl: string, links: string[], max = 4): string[] {
  let host: string;
  try { host = new URL(pageUrl).hostname.replace(/^www\./, ""); } catch { return []; }
  const out = new Set<string>();
  for (const l of links) {
    let u: URL;
    try { u = new URL(l); } catch { continue; }
    if (u.hostname.replace(/^www\./, "") !== host) continue;
    const path = u.pathname.toLowerCase();
    if (!/(detail|inzerat|nemovitost|nabidka|\/prodej-bytu|\/byt-)/.test(path) && !/\d{6,}/.test(path)) continue;
    if (/(hledani|vyhledavani|\/s\/|search|prodane)/.test(path)) continue;
    const c = canonicalUrl(u.toString());
    if (c && c !== canonicalUrl(pageUrl)) out.add(c);
    if (out.size >= max) break;
  }
  return [...out];
}
