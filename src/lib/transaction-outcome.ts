/**
 * Reality Investor — Transaction Outcome Engine.
 *
 * Separates three quantities that are often incorrectly collapsed into one:
 * 1) latent/fair value,
 * 2) probability the listing converts to a transaction,
 * 3) conditional transaction price if it converts.
 *
 * This prevents the AVM from pretending that "fair value" is the same thing as
 * the price that a particular buyer will actually pay.
 */

export interface TransactionOutcomeInput {
  askingPrice:number;
  fairValueP50:number;
  fairValueP10:number;
  fairValueP90:number;
  daysOnMarket:number;
  priceCuts:number;
  priceCutBps:number;
  listingFreshness:number;
  propertyAtypicality:number;
  marketLiquidity:number;
  financingFriction:number;
  valuationConfidence:number;
  transactionEvidenceShare:number;
}

export interface TransactionOutcome {
  saleProbability:number;
  conditionalPriceP10:number;
  conditionalPriceP50:number;
  conditionalPriceP90:number;
  expectedTransactionPrice:number;
  expectedGapToAskBps:number;
  expectedGapToFairValueBps:number;
  marketabilityScore:number;
  confidence:number;
  warnings:string[];
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));
const logistic=(x:number)=>1/(1+Math.exp(-x));

export function transactionOutcome(x:TransactionOutcomeInput):TransactionOutcome{
  const dom=clamp(x.daysOnMarket/180,0,2);
  const cuts=clamp(x.priceCuts/3,0,2);
  const cutDepth=clamp(x.priceCutBps/1000,0,2);
  const freshness=clamp(x.listingFreshness,0,1);
  const atypicality=clamp(x.propertyAtypicality,0,1);
  const liquidity=clamp(x.marketLiquidity,0,1);
  const financing=clamp(x.financingFriction,0,1);
  const confidence=clamp(x.valuationConfidence,0,1);

  // Prior only until calibrated against matched listing->transaction outcomes.
  const saleProbability=clamp(logistic(
    0.35+0.65*dom+0.45*cuts+0.35*cutDepth+
    0.35*liquidity+0.20*freshness-
    0.65*financing-0.60*atypicality
  ),0.03,0.97);

  const negotiationPressure=clamp(
    0.55*dom+0.25*cuts+0.20*cutDepth+
    0.25*(1-liquidity)-0.25*freshness,
    0,1
  );

  const center=x.fairValueP50*(1-0.06*negotiationPressure);
  const spread=(x.fairValueP90-x.fairValueP10)/2;
  const conditionalPriceP10=Math.max(0,center-spread);
  const conditionalPriceP90=center+spread;
  const expectedTransactionPrice=center*saleProbability+x.askingPrice*(1-saleProbability);

  const warnings:string[]=[];
  if(x.transactionEvidenceShare<0.30)warnings.push("low realized-transaction evidence");
  if(x.propertyAtypicality>0.65)warnings.push("atypical property may contain unobserved attributes");
  if(x.valuationConfidence<0.55)warnings.push("valuation confidence is low");
  if(x.financingFriction>0.65)warnings.push("financing friction may suppress conversion");

  return {
    saleProbability,
    conditionalPriceP10,
    conditionalPriceP50:center,
    conditionalPriceP90,
    expectedTransactionPrice,
    expectedGapToAskBps:(expectedTransactionPrice/x.askingPrice-1)*10000,
    expectedGapToFairValueBps:x.fairValueP50>0?(expectedTransactionPrice/x.fairValueP50-1)*10000:0,
    marketabilityScore:100*(0.40*saleProbability+0.30*(1-atypicality)+0.30*liquidity),
    confidence:clamp(
      0.40*confidence+0.30*x.transactionEvidenceShare+0.15*liquidity+0.15*(1-atypicality),
      0,1
    ),
    warnings
  };
}
