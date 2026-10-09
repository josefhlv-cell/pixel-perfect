/**
 * Reality Investor — Contextual Forecast Strategy.
 *
 * Chooses a forecast strategy from empirical genome evidence. Sparse or
 * fragile contexts deliberately fall back to ensemble/uncertain mode.
 */

import type {ForecastGenomeV2,SkillCell} from "./forecast-genome-v2";

export interface StrategyRequest {
  submarket:string;
  regime:string;
  horizonMonths:number;
}

export interface ForecastStrategy {
  mode:"CHAMPION"|"ENSEMBLE"|"INSUFFICIENT_EVIDENCE";
  primaryModel:string|null;
  candidateModels:string[];
  confidenceMultiplier:number;
  reason:string;
}

export function selectForecastStrategy(
  genome:ForecastGenomeV2,
  request:StrategyRequest,
):ForecastStrategy{
  const cells=genome.cells.filter(c=>
    c.submarket===request.submarket&&
    c.regime===request.regime&&
    c.horizonMonths===request.horizonMonths
  );

  const usable=cells
    .filter(c=>c.status!=="INSUFFICIENT_DATA")
    .sort((a,b)=>b.trust-a.trust);

  if(!usable.length){
    return {
      mode:"INSUFFICIENT_EVIDENCE",
      primaryModel:null,
      candidateModels:[],
      confidenceMultiplier:.25,
      reason:"No sufficient out-of-sample evidence exists for this context.",
    };
  }

  const strong=usable.filter(c=>c.status==="CHAMPION_ZONE");
  if(strong.length){
    return {
      mode:"CHAMPION",
      primaryModel:strong[0]!.model,
      candidateModels:usable.slice(0,3).map(c=>c.model),
      confidenceMultiplier:Math.min(.95,.55+strong[0]!.trust*.4),
      reason:"A contextual champion has sufficient empirical evidence.",
    };
  }

  return {
    mode:"ENSEMBLE",
    primaryModel:usable[0]!.model,
    candidateModels:usable.slice(0,3).map(c=>c.model),
    confidenceMultiplier:Math.min(.8,.4+usable[0]!.trust*.4),
    reason:"No contextual champion; combine the strongest empirically supported models.",
  };
}
