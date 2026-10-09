import type { ListingRow, PropertyRow, MarketRow } from "../deals";
import { buildPropertyFutureTwin, type PropertyTwinInput, type PropertyDecision } from "./property-future-twin";

export type PropertyTwinContext = {
  listing: ListingRow;
  property: PropertyRow | null;
  market: MarketRow | null;
  fairValue: { p10: number; p50: number; p90: number; confidence: number } | null;
  rent: { monthly: number; p10?: number; p90?: number; confidence?: number } | null;
  marketGrowth: { p10: number; p50: number; p90: number };
  liquidityScore: number;
  financingRate: number;
  monthlyCosts?: number;
  loanAmount?: number;
};

export type LivePropertyTwin = {
  input: PropertyTwinInput;
  decision: PropertyDecision;
  assumptions: string[];
};

export function buildLivePropertyTwin(context: PropertyTwinContext): LivePropertyTwin | null {
  const purchasePrice = Number(context.listing.price);
  if (!Number.isFinite(purchasePrice) || purchasePrice <= 0 || !context.fairValue || !context.rent) return null;

  const input: PropertyTwinInput = {
    purchasePrice,
    fairValue: context.fairValue.p50,
    fairValueP10: context.fairValue.p10,
    fairValueP90: context.fairValue.p90,
    valuationConfidence: context.fairValue.confidence,
    monthlyRent: context.rent.monthly,
    monthlyCosts: context.monthlyCosts ?? context.rent.monthly * 0.15,
    financingRate: context.financingRate,
    loanAmount: context.loanAmount ?? purchasePrice * 0.8,
    horizonMonths: 60,
    marketGrowthP50: context.marketGrowth.p50,
    marketGrowthP10: context.marketGrowth.p10,
    marketGrowthP90: context.marketGrowth.p90,
    liquidityScore: context.liquidityScore,
  };

  const assumptions = [
    "Tržní růst je scénářový vstup, nikoli garantovaná predikce.",
    "Nájem musí být aktualizován podle aktuálních lokálních dat.",
    "Financování je citlivé na sazbu a LTV; změna sazby vyžaduje nový výpočet.",
  ];

  if (context.rent.confidence != null && context.rent.confidence < 0.6) {
    assumptions.push("Nízká jistota nájmu omezuje důvěru Property Twin.");
  }

  return { input, decision: buildPropertyFutureTwin(input), assumptions };
}
