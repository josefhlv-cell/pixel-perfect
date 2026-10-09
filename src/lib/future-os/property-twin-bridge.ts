import { buildPropertyFutureTwin, type PropertyTwinInput } from "./property-future-twin";

export type PropertyTwinMarketContext = {
  propertyId: string;
  purchasePrice: number;
  fairValue: number;
  fairValueP10?: number;
  fairValueP90?: number;
  valuationConfidence?: number;
  monthlyRent: number;
  monthlyCosts: number;
  financingRate: number;
  loanAmount: number;
  horizonMonths?: number;
  marketGrowthP50: number;
  marketGrowthP10: number;
  marketGrowthP90: number;
  liquidityScore: number;
};

export type PropertyTwinSnapshot = {
  propertyId: string;
  generatedAt: string;
  input: PropertyTwinInput;
  decision: ReturnType<typeof buildPropertyFutureTwin>;
};

export function buildPropertyTwinSnapshot(context: PropertyTwinMarketContext): PropertyTwinSnapshot {
  const input: PropertyTwinInput = {
    ...context,
    horizonMonths: context.horizonMonths ?? 60,
  };
  return {
    propertyId: context.propertyId,
    generatedAt: new Date().toISOString(),
    input,
    decision: buildPropertyFutureTwin(input),
  };
}
