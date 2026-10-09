/**
 * Reality Investor — Negotiation Intelligence.
 *
 * This is a calibration-ready transaction/negotiation model contract.
 * It does NOT pretend that the current coefficients are learned from a
 * transaction dataset. Until historical matched offer->sale observations are
 * supplied, the engine exposes transparent priors and labels them as such.
 *
 * Goal:
 * asking price -> realistic transaction distribution -> offer acceptance
 * probability -> expected investor utility.
 */

export type NegotiationLabel =
  | "HIGH_LEVERAGE"
  | "NEGOTIABLE"
  | "TIGHT"
  | "UNRELIABLE";

export interface NegotiationSignal {
  askingPrice:number;
  estimatedFairValue:number;
  fairValueP10:number;
  fairValueP90:number;
  daysOnMarket:number;
  priceCuts:number;
  totalCutBps:number;
  comparableCount:number;
  marketLiquidity:number; // 0..1
  modelConfidence:number; // 0..1
  transactionEvidenceShare:number; // 0..1
}

export interface OfferScenario {
  offerPrice:number;
  discountToAskBps:number;
  discountToFairValueBps:number;
  acceptanceProbability:number;
  expectedTransactionPrice:number;
  expectedInvestorEdgeBps:number;
  downsideRiskBps:number;
  label:NegotiationLabel;
}

export interface NegotiationPlan {
  opening:number;
  target:number;
  walkAway:number;
  scenarios:OfferScenario[];
  rationale:string[];
  evidenceQuality:number;
  calibrationStatus:"PRIOR_ONLY"|"CALIBRATION_READY"|"CALIBRATED";
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

function logistic(x:number){return 1/(1+Math.exp(-x));}

/**
 * Transparent prior. Replace coefficients only after walk-forward training.
 * Positive DOM/cuts/liquidity increase bargaining power; high confidence in
 * fair value reduces the need for extreme opening discounts.
 */
function acceptancePrior(
  s:NegotiationSignal,
  offer:number,
):number{
  const discount=(s.askingPrice-offer)/Math.max(1,s.askingPrice);
  const dom=clamp(s.daysOnMarket/180,0,2);
  const cuts=clamp(s.priceCuts/3,0,2);
  const liquidity=clamp(s.marketLiquidity,0,1);
  const uncertainty=1-clamp(s.modelConfidence,0,1);

  const z=
    -0.15+
    7.5*discount+
    0.85*dom+
    0.55*cuts+
    0.35*(1-liquidity)-
    0.45*uncertainty;

  return clamp(logistic(z),0.02,0.98);
}

export function negotiationScenarios(
  s:NegotiationSignal,
  discountsBps=[0,200,500,800,1000,1200,1500],
):OfferScenario[]{
  return discountsBps.map(discountBps=>{
    const offer=s.askingPrice*(1-discountBps/10000);
    const acceptance=acceptancePrior(s,offer);
    const fair=s.estimatedFairValue;
    const expected=s.askingPrice*(1-acceptance*discountBps/10000);
    const edge=(fair>0?(fair-expected)/fair:0)*10000;
    const downside=(s.fairValueP10>0?(expected-s.fairValueP10)/s.fairValueP10:0)*10000;

    const label:NegotiationLabel=
      s.transactionEvidenceShare<0.20||s.comparableCount<5
        ?"UNRELIABLE"
        :acceptance>=0.70&&discountBps>=500
          ?"HIGH_LEVERAGE"
          :acceptance>=0.45
            ?"NEGOTIABLE"
            :"TIGHT";

    return {
      offerPrice:offer,
      discountToAskBps:discountBps,
      discountToFairValueBps:(fair>0?(offer-fair)/fair:0)*10000,
      acceptanceProbability:acceptance,
      expectedTransactionPrice:expected,
      expectedInvestorEdgeBps:edge,
      downsideRiskBps:downside,
      label,
    };
  });
}

export function buildNegotiationPlan(s:NegotiationSignal):NegotiationPlan{
  const scenarios=negotiationScenarios(s);
  const valid=scenarios.filter(x=>x.label!=="UNRELIABLE");
  const best=[...valid].sort((a,b)=>b.expectedInvestorEdgeBps-b.expectedInvestorEdgeBps)[0]
    ??scenarios[Math.floor(scenarios.length/2)]!;

  const opening=best.offerPrice;
  const target=s.estimatedFairValue;
  const walkAway=s.fairValueP10;

  const rationale:string[]=[];
  if(s.daysOnMarket>=90) rationale.push("long time on market increases potential bargaining leverage");
  if(s.priceCuts>0) rationale.push("previous price reductions indicate revealed seller resistance");
  if(s.totalCutBps>=500) rationale.push("material historical price reduction supports testing a stronger offer");
  if(s.transactionEvidenceShare<0.40) rationale.push("limited realized-transaction evidence reduces confidence");
  if(s.modelConfidence<0.60) rationale.push("valuation uncertainty is high; preserve a wider safety margin");

  return {
    opening,
    target,
    walkAway,
    scenarios,
    rationale,
    evidenceQuality:clamp(
      0.35*clamp(s.transactionEvidenceShare,0,1)+
      0.25*clamp(s.comparableCount/20,0,1)+
      0.20*clamp(s.modelConfidence,0,1)+
      0.20*clamp(s.marketLiquidity,0,1),
      0,1
    ),
    calibrationStatus:"PRIOR_ONLY"
  };
}
