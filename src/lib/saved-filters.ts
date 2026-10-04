/** Persist Deal Hunter filter presets in localStorage. */

export interface DealFilters {
  location: string;
  radius: string;
  type: string;
  rooms: string;
  maxPrice: string;
  minYield: string;
  minDiscount: string;
  minCashFlow: string;
  maxLtv: string;
  strategy: string;
}

export interface SavedFilter {
  id: string;
  name: string;
  filters: DealFilters;
  createdAt: string;
}

const KEY = "ri-saved-filters";

export function loadSavedFilters(): SavedFilter[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedFilter[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveFilterPreset(name: string, filters: DealFilters): SavedFilter[] {
  const list = loadSavedFilters();
  const item: SavedFilter = {
    id: crypto.randomUUID(),
    name: name.trim() || "Filtr",
    filters: { ...filters },
    createdAt: new Date().toISOString(),
  };
  const next = [item, ...list].slice(0, 20);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function deleteFilterPreset(id: string): SavedFilter[] {
  const next = loadSavedFilters().filter((x) => x.id !== id);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
