/**
 * Geocoding helpers for Deal Hunter distance search.
 * Uses OpenStreetMap Nominatim (free, no API key). Czech addresses preferred.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
  displayName: string;
}

const NOMINATIM = "https://nominatim.openstreetmap.org/search";

/** Geocode a free-text address / place in Czechia. Returns null if not found. */
export async function geocodeAddress(query: string): Promise<GeoPoint | null> {
  const q = query.trim();
  if (q.length < 2) return null;

  const params = new URLSearchParams({
    q,
    format: "json",
    limit: "1",
    countrycodes: "cz",
    addressdetails: "0",
  });

  try {
    const res = await fetch(`${NOMINATIM}?${params}`, {
      headers: {
        Accept: "application/json",
        // Nominatim usage policy requires a valid User-Agent
        "User-Agent": "RealityInvestor/1.0 (deal-hunter; contact@lovable.app)",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { lat: string; lon: string; display_name?: string }[];
    if (!Array.isArray(data) || data.length === 0) return null;
    const lat = Number(data[0].lat);
    const lng = Number(data[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    // Sanity: roughly Czechia bounds
    if (lat < 48.5 || lat > 51.1 || lng < 12.0 || lng > 18.9) return null;
    return {
      lat,
      lng,
      displayName: data[0].display_name ?? q,
    };
  } catch {
    return null;
  }
}
