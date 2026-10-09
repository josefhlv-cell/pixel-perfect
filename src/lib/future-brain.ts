/**
 * Future Brain — regime switching and Bayesian-style evidence fusion.
 * Pure TypeScript: safe to run in the server runtime without a Python dependency.
 */

export type HiddenRegime="EXPANSION"|"LATE_EXPANSION"|"SLOWDOWN"|"CONTRACTION"|"RECOVERY";

export interface RegimeState{
  regime:HiddenRegime;
  probabilities:Record<HiddenRegime,number>;
  transitionRisk:number;
  persistence:number;
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));
const softmax=(xs:number[])=>{
  const m=Math.max(...xs),e=xs.map(x=>Math.exp(clamp(x-m,-30,30))),s=e.reduce((a,b)=>a+b,0);
  return e.map(x=>x/s);
};

export function inferHiddenRegime(features:{
  priceMomentum:number;
  inventoryMomentum:number;
  rateMomentum:number;
  creditMomentum:number;
  rentMomentum:number;
  employmentMomentum:number;
}):RegimeState{
  const f=features;
  const scores=[
    0.8*f.priceMomentum-0.3*f.inventoryMomentum-0.35*f.rateMomentum+0.25*f.creditMomentum+0.2*f.employmentMomentum,
    0.45*f.priceMomentum+0.5*f.inventoryMomentum+0.35*f.rateMomentum+0.15*f.creditMomentum,
    -0.25*f.priceMomentum+0.55*f.inventoryMomentum+0.45*f.rateMomentum-0.25*f.creditMomentum,
    -0.7*f.priceMomentum+0.35*f.inventoryMomentum+0.65*f.rateMomentum-0.45*f.creditMomentum-0.3*f.employmentMomentum,
    -0.15*f.priceMomentum-0.4*f.inventoryMomentum-0.35*f.rateMomentum+0.3*f.creditMomentum+0.4*f.employmentMomentum
  ];
  const p=softmax(scores);
  const regimes:HiddenRegime[]=["EXPANSION","LATE_EXPANSION","SLOWDOWN","CONTRACTION","RECOVERY"];
  const ranked=p.map((x,i)=>({x,i})).sort((a,b)=>b.x-a.x);
  const best=ranked[0]!;
  const second=ranked[1]!;
  return {
    regime:regimes[best.i]!,
    probabilities:Object.fromEntries(regimes.map((r,i)=>[r,p[i]!])) as Record<HiddenRegime,number>,
    transitionRisk:clamp(second.x/(best.x+0.0001),0,0.99),
    persistence:clamp(best.x*1.25,0,0.99)
  };
}

export interface Evidence{
  name:string;
  direction:-1|0|1;
  strength:number;
  reliability:number;
  horizonMonths:number;
}

export interface EvidenceFusion{
  score:number;
  probabilityBull:number;
  probabilityBear:number;
  evidenceAgreement:number;
  dominantDrivers:string[];
}

export function fuseEvidence(evidence:Evidence[]):EvidenceFusion{
  if(!evidence.length)return {score:0,probabilityBull:0.5,probabilityBear:0.5,evidenceAgreement:0,dominantDrivers:[]};
  const weighted=evidence.map(e=>e.direction*clamp(e.strength,0,1)*clamp(e.reliability,0,1));
  const score=weighted.reduce((a,b)=>a+b,0)/Math.max(1,evidence.reduce((a,e)=>a+e.strength*e.reliability,0));
  const bull=evidence.filter(e=>e.direction>0).reduce((s,e)=>s+e.strength*e.reliability,0);
  const bear=evidence.filter(e=>e.direction<0).reduce((s,e)=>s+e.strength*e.reliability,0);
  const total=bull+bear;
  const agreement=total?1-Math.min(1,(Math.min(bull,bear)*2)/total):0;
  return {
    score,
    probabilityBull:clamp(0.5+score*0.5,0.01,0.99),
    probabilityBear:clamp(0.5-score*0.5,0.01,0.99),
    evidenceAgreement:agreement,
    dominantDrivers:[...evidence].sort((a,b)=>b.strength*b.reliability-a.strength*a.reliability).slice(0,5).map(e=>e.name)
  };
}
