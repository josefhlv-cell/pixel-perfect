/**
 * Valuation guardrails.
 *
 * City-level asking-price aggregates are not property-level comparables. Until
 * the app has verified sale comparables with location, layout, condition and
 * time/provenance, do not present a city-average multiplication as a valuation.
 */
import { calculateGrossYield } from "./calculations";

export interface MarketStat {
  city: string;
  avg_asking_price_m2: number | null;
  avg_rent_m2: number | null;
  listings_count: number | null;
  is_sample: boolean;
}

export interface ValuationEstimate {
  estimatedValue: number;
  low: number;
  high: number;
  method: "verified_sale_comparables";
  comparables: number;
  confidence: "low" | "medium" | "high";
  isSample: boolean;
}

/**
 * Fail closed: market_statistics contains city-level asking-price averages,
 * not comparable transactions/listings for this individual property.
 */
export function estimateValue(
  areaM2: number | null,
  stat: MarketStat | undefined,
): ValuationEstimate | null {
  void areaM2;
  void stat;
  return null;
}

/** City-level rent is also not enough to value a specific rental unit. */
export function estimateRent(areaM2: number | null, stat: MarketStat | undefined): number | null {
  void areaM2;
  void stat;
  return null;
}

/** % difference between asking price and estimate, in bps (negative = below estimate). */
export function priceDifferenceBps(price: number | null, estimate: number | null): number | null {
  if (!price || !estimate) return null;
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
