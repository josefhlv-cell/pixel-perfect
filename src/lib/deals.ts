/**
 * Listing enrichment: joins listing + property + market stats and runs the
 * EXISTING valuation / deal-priority / calculation engines. No math lives in UI.
 */
import { calculateTotalReturn, DEFAULT_ASSUMPTIONS, type InvestmentInput } from "./calculations";
import {
  computeDealPriority,
  estimateRent,
  estimateValue,
  grossYieldFor,
  priceDifferenceBps,
  type MarketStat,
  type SaleComparable,
} from "./valuation";
import type { Database } from "@/integrations/supabase/types";

export type ListingRow = Database["public"]["Tables"]["listings"]["Row"];
export type PropertyRow = Database["public"]["Tables"]["properties"]["Row"];
export type SnapshotRow = Database["public"]["Tables"]["listing_snapshots"]["Row"];
export type MarketRow = Database["public"]["Tables"]["market_statistics"]["Row"];

export interface Reason {
  text: string;
  positive: boolean;
}

export interface EnrichedListing {
  listing: ListingRow;
  property: PropertyRow | null;
  city: string | null;
  pricePerM2: number | null;
  estimate: ReturnType<typeof estimateValue>;
  diffBps: number | null;
  rent: number | null;
  grossYieldBps: number | null;
  monthlyCashFlow: number | null;
  priceDropped: boolean;
  priceHistory: { at: string; price: number | null }[];
  priority: number;
  reasons: Reason[];
  isSample: boolean;
}

/** Latest market stat per city. */
export function latestStatsByCity(rows: MarketRow[]): Map<string, MarketStat> {
  const m = new Map<string, MarketRow>();
  for (const r of rows) {
    if (r.is_sample) continue;
    const cur = m.get(r.city);
    if (!cur || cur.period < r.period) m.set(r.city, r);
  }
  return new Map([...m].map(([k, r]) => [k, r as MarketStat]));
}

/** Build the evidence pool from production listings; no city-average fallback. */
export function saleComparablesFromListings(
  rows: ListingRow[],
  properties: Map<string, PropertyRow>,
): SaleComparable[] {
  return rows.flatMap((row) => {
    const property = properties.get(row.property_id);
    const areaM2 = row.area_m2 == null ? null : Number(row.area_m2);
    const priceCzk = row.price == null ? null : Number(row.price);
    const city = property?.city ?? row.location;
    const observedAt = row.last_verified_at ?? row.last_seen_at ?? row.updated_at ?? row.created_at;
    if (
      !city ||
      areaM2 == null ||
      !Number.isFinite(areaM2) ||
      areaM2 <= 0 ||
      priceCzk == null ||
      !Number.isFinite(priceCzk) ||
      priceCzk <= 0 ||
      !row.source_url ||
      !observedAt
    ) return [];
    const locationParts = (row.location ?? city).split(/[,–-]/).map((part) => part.trim());
    return [{
      listingId: row.id,
      propertyId: row.property_id,
      sourceUrl: row.source_url,
      city,
      district: locationParts.length > 1 ? locationParts.slice(1).join(", ") : null,
      rooms: property?.disposition ?? row.rooms,
      propertyType: property?.property_type ?? row.property_type,
      condition: property?.condition,
      buildingType: property?.building_type,
      floor: property?.floor,
      areaM2,
      priceCzk,
      observedAt,
      availability: row.availability_status,
      freshness: row.freshness_status,
      isSample: row.is_sample || (property?.is_sample ?? false),
    }];
  });
}

/** Default investment input for a listing (price, estimated rent, Czech defaults). */
export function defaultInvestmentInput(
  price: number,
  rent: number,
  overrides: Partial<InvestmentInput> = {},
): InvestmentInput {
  return {
    purchasePrice: price,
    closingCosts: Math.round((price * DEFAULT_ASSUMPTIONS.closingCostsBps) / 10_000),
    renovation: 0,
    ltvBps: DEFAULT_ASSUMPTIONS.ltvBps,
    interestRateBps: DEFAULT_ASSUMPTIONS.interestRateBps,
    termMonths: DEFAULT_ASSUMPTIONS.termMonths,
    monthlyRent: rent,
    vacancyBps: DEFAULT_ASSUMPTIONS.vacancyBps,
    monthlyExpenses: Math.round(rent * 0.15),
    appreciationBps: DEFAULT_ASSUMPTIONS.appreciationBps,
    rentGrowthBps: DEFAULT_ASSUMPTIONS.rentGrowthBps,
    holdingYears: DEFAULT_ASSUMPTIONS.holdingYears,
    saleCostsBps: DEFAULT_ASSUMPTIONS.saleCostsBps,
    ...overrides,
  } as InvestmentInput;
}

export function enrichListing(
  listing: ListingRow,
  property: PropertyRow | null,
  stats: Map<string, MarketStat>,
  snapshots: SnapshotRow[],
  saleComparables: SaleComparable[] = [],
): EnrichedListing {
  if (!listing.is_sample && property?.is_sample) property = null;
  const city = property?.city ?? listing.location ?? null;
  const area =
    listing.area_m2 != null
      ? Number(listing.area_m2)
      : property?.area_m2 != null
        ? Number(property.area_m2)
        : null;
  // Live listings often carry "City, District" (e.g. "Pardubice, Zelené Předměstí"); fall back to the base city.
  const stat = city ? (stats.get(city) ?? stats.get(city.split(/[,–-]/)[0]!.trim())) : undefined;
  const locationParts = (listing.location ?? city ?? "").split(/[,–-]/).map((part) => part.trim());
  const saleTarget = city && area != null && area > 0 ? {
    listingId: listing.id,
    propertyId: listing.property_id,
    city,
    district: locationParts.length > 1 ? locationParts.slice(1).join(", ") : null,
    rooms: property?.disposition ?? listing.rooms,
    propertyType: property?.property_type ?? listing.property_type,
    condition: property?.condition,
    buildingType: property?.building_type,
    floor: property?.floor,
    areaM2: area,
  } : null;
  const estimate = estimateValue(saleTarget, saleComparables);
  const rent = estimateRent(area, stat);
  const diffBps = priceDifferenceBps(listing.price, estimate?.estimatedValue ?? null);
  const grossYieldBps = grossYieldFor(listing.price, rent);
  const history = snapshots
    .filter((s) => s.listing_id === listing.id)
    .sort((a, b) => a.observed_at.localeCompare(b.observed_at))
    .map((s) => ({ at: s.observed_at, price: s.price }));
  const prices = history.map((h) => h.price).filter((p): p is number => p != null);
  const priceDropped = prices.length >= 2 && prices[prices.length - 1]! < prices[0]!;
  const monthlyCashFlow =
    listing.price && rent
      ? calculateTotalReturn(defaultInvestmentInput(listing.price, rent)).monthlyCashFlow
      : null;
  const priority = computeDealPriority({
    diffBps,
    grossYieldBps,
    freshness: listing.freshness_status,
    availability: listing.availability_status,
    priceDropped,
  });

  const reasons: Reason[] = [];
  if (diffBps != null && diffBps < -300)
    reasons.push({
      positive: true,
      text: `Cena ${Math.abs(diffBps / 100).toFixed(1)} % pod odhadem z nabídkových cen`,
    });
  if (diffBps != null && diffBps > 500)
    reasons.push({
      positive: false,
      text: `Cena ${(diffBps / 100).toFixed(1)} % nad odhadem z nabídkových cen`,
    });
  if (grossYieldBps != null && grossYieldBps >= 500)
    reasons.push({
      positive: true,
      text: `Odhad ročního nájmu před náklady tvoří ${(grossYieldBps / 100).toFixed(2).replace(".", ",")} % kupní ceny`,
    });
  if (grossYieldBps != null && grossYieldBps < 400)
    reasons.push({
      positive: false,
      text: `Odhad ročního nájmu před náklady tvoří jen ${(grossYieldBps / 100).toFixed(2).replace(".", ",")} % kupní ceny`,
    });
  if (listing.freshness_status === "FRESH")
    reasons.push({ positive: true, text: "Čerstvá nabídka" });
  if (listing.freshness_status === "STALE" || listing.freshness_status === "AGING")
    reasons.push({ positive: false, text: "Nabídka dlouho neověřena" });
  if (listing.availability_status === "ACTIVE_CONFIRMED")
    reasons.push({ positive: true, text: "Dostupnost ověřena" });
  if (listing.availability_status === "ACTIVE_UNCONFIRMED")
    reasons.push({ positive: false, text: "Dostupnost neověřena" });
  if (priceDropped) reasons.push({ positive: true, text: "Cena byla snížena" });
  if (monthlyCashFlow != null && monthlyCashFlow < 0)
    reasons.push({
      positive: false,
      text: "Nájem nepokryje náklady a splátku hypotéky na 80 % ceny; každý měsíc je třeba doplácet",
    });
  if (rent != null)
    reasons.push({ positive: false, text: "Nájemní odhad vyžaduje kontrolu srovnatelných pronájmů a oddělení služeb a energií." });
  else
    reasons.push({
      positive: false,
      text: "Odhad nájmu není k dispozici: chybí ověřené srovnatelné nabídky; výnos a cash flow proto nejsou dopočítány.",
    });
  if (estimate == null) reasons.push({ positive: false, text: "Chybí srovnatelné nabídky: pro orientační cenový benchmark je potřeba alespoň pět aktuálních inzerátů." });

  return {
    listing,
    property,
    city,
    pricePerM2: listing.price && area ? Math.round(listing.price / area) : null,
    estimate,
    diffBps,
    rent,
    grossYieldBps,
    monthlyCashFlow,
    priceDropped,
    priceHistory: history,
    priority,
    reasons,
    isSample: listing.is_sample || (property?.is_sample ?? false),
  };
}

/** Explains Deal Priority score components transparently (mirrors computeDealPriority weights). */
export function priorityBreakdown(
  e: EnrichedListing,
): { label: string; points: number; max: number }[] {
  const dead = ["SOLD", "REMOVED", "EXPIRED"].includes(e.listing.availability_status);
  if (dead) return [{ label: "Nabídka není aktivní", points: 0, max: 100 }];
  return [
    {
      label: "Sleva vůči odhadu",
      points: e.diffBps != null ? Math.round(Math.max(0, Math.min(35, -e.diffBps / 40))) : 0,
      max: 35,
    },
    {
      label: "Roční nájem vůči kupní ceně",
      points:
        e.grossYieldBps != null
          ? Math.round(Math.max(0, Math.min(30, (e.grossYieldBps - 300) / 13)))
          : 0,
      max: 30,
    },
    {
      label: "Aktuálnost nabídky",
      points:
        ({ FRESH: 20, RECENT: 14, AGING: 7, STALE: 2 } as Record<string, number>)[
          e.listing.freshness_status
        ] ?? 0,
      max: 20,
    },
    {
      label: "Ověřená dostupnost",
      points:
        e.listing.availability_status === "ACTIVE_CONFIRMED"
          ? 10
          : e.listing.availability_status === "ACTIVE_UNCONFIRMED"
            ? 4
            : 0,
      max: 10,
    },
    { label: "Snížení ceny", points: e.priceDropped ? 5 : 0, max: 5 },
  ];
}
