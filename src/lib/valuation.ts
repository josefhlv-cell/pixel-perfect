/**
 * Evidence-gated property benchmarks and Deal Priority.
 *
 * Sale benchmark uses active, non-sample listing comparables only. These are
 * asking prices, never completed transaction prices. City averages alone are
 * not accepted as evidence for a property-level estimate.
 */
import { calculateGrossYield } from "./calculations";

export interface MarketStat {
  city: string;
  avg_asking_price_m2: number | null;
  avg_rent_m2: number | null;
  listings_count: number | null;
  is_sample: boolean;
}

export type SaleComparable = {
  listingId: string;
  sourceUrl: string;
  city: string;
  district?: string | null;
  rooms?: string | null;
  propertyType?: string | null;
  areaM2: number;
  priceCzk: number;
  observedAt: string;
  availability: string;
  freshness: string;
  isSample: boolean;
};

export type SaleTarget = {
  listingId: string;
  city: string;
  district?: string | null;
  rooms?: string | null;
  propertyType?: string | null;
  areaM2: number;
};

export interface ValuationEstimate {
  estimatedValue: number;
  low: number;
  high: number;
  method: "active_listing_asking_comparables";
  comparables: number;
  confidence: "low" | "medium" | "high";
  isSample: false;
  evidenceAsOf: string;
  sources: string[];
}

const normalize = (value: string | null | undefined) =>
  (value ?? "").trim().toLocaleLowerCase("cs-CZ");
const baseCity = (value: string) => normalize(value.split(/[,–-]/)[0]);

function weightedQuantile(values: { value: number; weight: number }[], q: number): number {
  const sorted = [...values].sort((a, b) => a.value - b.value);
  const total = sorted.reduce((sum, item) => sum + item.weight, 0);
  let cumulative = 0;
  for (const item of sorted) {
    cumulative += item.weight;
    if (cumulative >= total * q) return item.value;
  }
  return sorted[sorted.length - 1]!.value;
}

/**
 * Conservative asking-price benchmark. Requires five unique, current, active,
 * non-sample listings matching city and (when available) layout/type, with area
 * within 35%. It must not be described as a realized sale value.
 */
export function estimateValueFromComparables(
  target: SaleTarget | null,
  comparables: SaleComparable[],
  asOfIso: string,
  minimumComparables = 5,
): ValuationEstimate | null {
  const asOf = Date.parse(asOfIso);
  if (
    !target ||
    !Number.isFinite(asOf) ||
    !target.city.trim() ||
    !(target.areaM2 > 0) ||
    !Number.isFinite(target.areaM2)
  ) return null;

  const seen = new Set<string>();
  const scored: { item: SaleComparable; pricePerM2: number; weight: number; observedMs: number }[] = [];
  for (const item of comparables) {
    if (
      item.listingId === target.listingId ||
      item.isSample ||
      !["ACTIVE_CONFIRMED", "ACTIVE_UNCONFIRMED"].includes(item.availability) ||
      ["STALE", "EXPIRED", "UNKNOWN"].includes(item.freshness) ||
      !item.sourceUrl.trim() ||
      !(item.areaM2 > 0) ||
      !(item.priceCzk > 0) ||
      !Number.isFinite(item.areaM2) ||
      !Number.isFinite(item.priceCzk)
    ) continue;
    const urlKey = item.sourceUrl.trim().toLocaleLowerCase("cs-CZ");
    if (seen.has(urlKey)) continue;
    seen.add(urlKey);

    if (baseCity(item.city) !== baseCity(target.city)) continue;
    if (target.rooms && item.rooms && normalize(target.rooms) !== normalize(item.rooms)) continue;
    if (target.propertyType && item.propertyType && normalize(target.propertyType) !== normalize(item.propertyType)) continue;

    const areaRatio = Math.abs(item.areaM2 - target.areaM2) / target.areaM2;
    if (areaRatio > 0.35) continue;
    const observedMs = Date.parse(item.observedAt);
    if (!Number.isFinite(observedMs) || observedMs > asOf) continue;
    const ageDays = (asOf - observedMs) / 86_400_000;
    if (ageDays > 180) continue;

    let weight = Math.exp(-areaRatio * 3) * Math.exp(-ageDays / 90);
    if (target.district && item.district) {
      weight *= normalize(target.district) === normalize(item.district) ? 1.35 : 0.75;
    }
    if (item.availability === "ACTIVE_CONFIRMED") weight *= 1.1;
    if (item.freshness === "FRESH") weight *= 1.1;
    scored.push({ item, pricePerM2: item.priceCzk / item.areaM2, weight, observedMs });
  }

  if (scored.length < minimumComparables) return null;
  const values = scored.map(({ pricePerM2, weight }) => ({ value: pricePerM2, weight }));
  const median = weightedQuantile(values, 0.5);
  const lowPerM2 = weightedQuantile(values, 0.2);
  const highPerM2 = weightedQuantile(values, 0.8);
  const weightSum = scored.reduce((sum, item) => sum + item.weight, 0);
  const effectiveN = weightSum ** 2 / scored.reduce((sum, item) => sum + item.weight ** 2, 0);
  return {
    estimatedValue: Math.round(median * target.areaM2),
    low: Math.round(Math.min(lowPerM2, median) * target.areaM2),
    high: Math.round(Math.max(highPerM2, median) * target.areaM2),
    method: "active_listing_asking_comparables",
    comparables: scored.length,
    confidence: effectiveN >= 12 ? "high" : effectiveN >= 7 ? "medium" : "low",
    isSample: false,
    evidenceAsOf: new Date(Math.max(...scored.map((item) => item.observedMs))).toISOString(),
    sources: scored.map((item) => item.item.sourceUrl),
  };
}

/** No comparable evidence means no property-specific sale benchmark. */
export function estimateValue(
  target: SaleTarget | null,
  comparables: SaleComparable[] = [],
  asOfIso = new Date().toISOString(),
): ValuationEstimate | null {
  return estimateValueFromComparables(target, comparables, asOfIso);
}

/** City-level rent is not enough to estimate rent for an individual unit. */
export function estimateRent(_areaM2: number | null, _stat: MarketStat | undefined): number | null {
  return null;
}

/** % difference between asking price and estimate, in bps (negative = below estimate). */
export function priceDifferenceBps(price: number | null, estimate: number | null): number | null {
  if (price == null || estimate == null || price <= 0 || estimate <= 0) return null;
  return Math.round(((price - estimate) / estimate) * 10_000);
}

export interface DealPriorityInput {
  diffBps: number | null;
  grossYieldBps: number | null;
  freshness: string;
  availability: string;
  priceDropped: boolean;
}

/** 0–100. Unknown factors contribute 0 (no invented upside). */
export function computeDealPriority(i: DealPriorityInput): number {
  if (i.availability === "SOLD" || i.availability === "REMOVED" || i.availability === "EXPIRED")
    return 0;
  let s = 0;
  if (i.diffBps != null) s += Math.max(0, Math.min(35, -i.diffBps / 40));
  if (i.grossYieldBps != null) s += Math.max(0, Math.min(30, (i.grossYieldBps - 300) / 13));
  s += { FRESH: 20, RECENT: 14, AGING: 7, STALE: 2, EXPIRED: 0, UNKNOWN: 0 }[i.freshness] ?? 0;
  if (i.availability === "ACTIVE_CONFIRMED") s += 10;
  else if (i.availability === "ACTIVE_UNCONFIRMED") s += 4;
  if (i.priceDropped) s += 5;
  return Math.round(Math.min(100, s));
}

export function grossYieldFor(price: number | null, rent: number | null): number | null {
  if (!price || !rent) return null;
  return calculateGrossYield(rent, price);
}
