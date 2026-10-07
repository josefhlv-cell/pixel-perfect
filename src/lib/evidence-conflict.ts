/**
 * Reality Investor — Evidence Conflict Engine.
 *
 * A forecast should lose confidence when independent sources disagree.
 * This is especially important when asking prices, transaction prices,
 * macro indicators and derived portal signals describe different layers
 * of the market.
 *
 * This module does not decide which source is "true". It quantifies conflict,
 * freshness and truth-level differences so downstream models can adapt.
 */

export type EvidenceKind=
  |"TRANSACTION"|"ASKING"|"RENT"|"MACRO"|"SUPPLY"|"DEMAND"|"LIQUIDITY"|"MODEL";

export interface EvidencePoint {
  sourceId:string;
  kind:EvidenceKind;
  value:number;
  weight:number;
  observedAt:number;
  availableAt:number;
  reliability:number;
}

export interface EvidenceConflict {
  center:number;
  dispersion:number;
  conflictScore:number;
  staleShare:number;
  truthWeightedMean:number;
  sourceCount:number;
  action:"NONE"|"WATCH"|"DOWNWEIGHT"|"BLOCK";
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

export function assessEvidenceConflict(
  points:EvidencePoint[],
  now:number,
  staleAfterMs=1000*60*60*24*45
):EvidenceConflict{
  if(!points.length)return {
    center:0,dispersion:1,conflictScore:1,staleShare:1,
    truthWeightedMean:0,sourceCount:0,action:"BLOCK"
  };

  const weights=points.map(p=>Math.max(0,p.weight*p.reliability));
  const total=weights.reduce((a,b)=>a+b,0)||1;
  const mean=points.reduce((s,p,i)=>s+p.value*weights[i],0)/total;
  const variance=points.reduce((s,p,i)=>s+weights[i]*(p.value-mean)**2,0)/total;
  const scale=Math.max(Math.abs(mean),1e-6);
  const dispersion=Math.sqrt(variance)/scale;
  const staleShare=points.filter(p=>now-p.observedAt>staleAfterMs).length/points.length;

  // Penalise disagreement between high-reliability observations more strongly.
  const conflictScore=clamp(dispersion*1.8+staleShare*.35,0,1);
  const action=conflictScore>=.75?"BLOCK":
    conflictScore>=.50?"DOWNWEIGHT":
    conflictScore>=.25?"WATCH":"NONE";

  return {
    center:mean,
    dispersion,
    conflictScore,
    staleShare,
    truthWeightedMean:mean,
    sourceCount:new Set(points.map(p=>p.sourceId)).size,
    action
  };
}
