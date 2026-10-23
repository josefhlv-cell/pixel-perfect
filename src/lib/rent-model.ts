/**
 * Explainable rent estimate from rental listings, not city-level rent-per-m² averages.
 * Pure deterministic function; it never fetches data or writes to the database.
 */
export type RentalComparable = {
  sourceUrl: string;
  city: string;
  district?: string | null;
  disposition: string;
  areaM2: number;
  monthlyRentCzk: number; // base rent only; services/energy excluded
  condition?: string | null;
  furnishing?: string | null;
  floor?: number | null;
  elevator?: boolean | null;
  parking?: boolean | null;
  storage?: boolean | null;
  balcony?: boolean | null;
  observedAt: string;
  isActive: boolean;
  isVerified: boolean;
  isSample: boolean;
};

export type RentTarget = Omit<RentalComparable, "sourceUrl" | "monthlyRentCzk" | "observedAt" | "isActive" | "isVerified" | "isSample">;

export type RentEstimate = {
  monthlyRentCzk: number;
  lowRentCzk: number;
  highRentCzk: number;
  comparableCount: number;
  method: "similarity_weighted_median";
  confidence: "low" | "medium" | "high";
  evidenceAsOf: string;
  sources: string[];
};

const normalize = (s: string | null | undefined) => (s ?? "").trim().toLocaleLowerCase("cs-CZ");
const knownEqual = (a: unknown, b: unknown) => a != null && b != null && a === b;

function similarity(target: RentTarget, c: RentalComparable, nowMs: number): number {
  if (normalize(target.city) !== normalize(c.city)) return 0;
  const targetLayout = normalize(target.disposition);
  if (!targetLayout || targetLayout !== normalize(c.disposition)) return 0;
  if (!(target.areaM2 > 0) || !(c.areaM2 > 0) || !(c.monthlyRentCzk > 0)) return 0;
  const areaRatio = Math.abs(c.areaM2 - target.areaM2) / target.areaM2;
  if (areaRatio > 0.35) return 0;
  let w = Math.exp(-areaRatio * 3);
  if (target.district && c.district) w *= normalize(target.district) === normalize(c.district) ? 1.35 : 0.72;
  if (target.condition && c.condition) w *= knownEqual(normalize(target.condition), normalize(c.condition)) ? 1.15 : 0.82;
  if (target.furnishing && c.furnishing) w *= knownEqual(normalize(target.furnishing), normalize(c.furnishing)) ? 1.12 : 0.88;
  for (const key of ["elevator", "parking", "storage", "balcony"] as const) {
    const tv = target[key], cv = c[key];
    if (tv != null && cv != null) w *= tv === cv ? 1.06 : 0.94;
  }
  if (target.floor != null && c.floor != null) w *= Math.abs(target.floor - c.floor) <= 1 ? 1.04 : 0.96;
  const ageDays = Math.max(0, (nowMs - Date.parse(c.observedAt)) / 86_400_000);
  if (!Number.isFinite(ageDays) || ageDays > 365) return 0;
  w *= Math.exp(-ageDays / 180);
  if (c.isVerified) w *= 1.15;
  return w;
}

function weightedQuantile(values: { value: number; weight: number }[], q: number): number {
  const sorted = [...values].sort((a, b) => a.value - b.value);
  const total = sorted.reduce((s, v) => s + v.weight, 0);
  let acc = 0;
  for (const item of sorted) {
    acc += item.weight;
    if (acc >= total * q) return item.value;
  }
  return sorted[sorted.length - 1]!.value;
}

/**
 * Minimum five unique, active, non-sample comparable listings.
 * Returns null rather than inventing a fallback if evidence is insufficient.
 * nowIso is injectable to make backtests deterministic and leakage-safe.
 */
export function estimateRentFromComparables(
  target: RentTarget,
  comparables: RentalComparable[],
  nowIso: string,
  minimumComparables = 5,
): RentEstimate | null {
  const nowMs = Date.parse(nowIso);
  if (!Number.isFinite(nowMs) || !target.city.trim() || !target.disposition.trim() || !(target.areaM2 > 0)) return null;
  const seen = new Set<string>();
  const scored: { item: RentalComparable; weight: number }[] = [];
  for (const item of comparables) {
    if (!item.isActive || item.isSample || !item.sourceUrl || !Number.isFinite(Date.parse(item.observedAt))) continue;
    const key = item.sourceUrl.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const weight = similarity(target, item, nowMs);
    if (weight > 0) scored.push({ item, weight });
  }
  if (scored.length < minimumComparables) return null;
  const weighted = scored.map(({ item, weight }) => ({ value: item.monthlyRentCzk, weight }));
  const median = weightedQuantile(weighted, 0.5);
  const low = weightedQuantile(weighted, 0.2);
  const high = weightedQuantile(weighted, 0.8);
  const weightSum = scored.reduce((s, v) => s + v.weight, 0);
  const effectiveN = weightSum ** 2 / scored.reduce((s, v) => s + v.weight ** 2, 0);
  const confidence = effectiveN >= 12 ? "high" : effectiveN >= 7 ? "medium" : "low";
  return {
    monthlyRentCzk: Math.round(median),
    lowRentCzk: Math.round(Math.min(low, median)),
    highRentCzk: Math.round(Math.max(high, median)),
    comparableCount: scored.length,
    method: "similarity_weighted_median",
    confidence,
    evidenceAsOf: new Date(Math.max(...scored.map(x => Date.parse(x.item.observedAt)))).toISOString(),
    sources: scored.map(x => x.item.sourceUrl),
  };
}
