/**
 * Reality Investor — Temporal Trust.
 *
 * Long-run accuracy is not enough in a non-stationary market.
 * This layer discounts old evidence and accelerates decay after detected
 * regime changes. It is a weighting mechanism, not a claim of causality.
 */

export interface TrustObservation {
  model:string;
  score:number;
  observedAt:number;
  regime:string;
  regimeChanged:boolean;
}

export interface TemporalTrust {
  model:string;
  rawScore:number;
  recencyWeightedScore:number;
  effectiveTrust:number;
  observations:number;
}

export function temporalTrust(rows:TrustObservation[],now:number,halfLifeDays=180):TemporalTrust[]{
  const byModel=new Map<string,TrustObservation[]>();
  for(const r of rows){
    const arr=byModel.get(r.model)??[];arr.push(r);byModel.set(r.model,arr);
  }
  return [...byModel].map(([model,items])=>{
    let weighted=0,weightTotal=0,raw=0;
    for(const x of items){
      const ageDays=Math.max(0,(now-x.observedAt)/86400000);
      const decay=Math.pow(.5,ageDays/halfLifeDays)*(x.regimeChanged?.55:1);
      weighted+=x.score*decay;weightTotal+=decay;raw+=x.score;
    }
    const recency=weightTotal?weighted/weightTotal:0;
    const rawScore=items.length?raw/items.length:0;
    return {
      model,rawScore,recencyWeightedScore:recency,
      effectiveTrust:Math.min(1,recency*(1-Math.exp(-items.length/12))),
      observations:items.length
    };
  }).sort((a,b)=>b.effectiveTrust-a.effectiveTrust);
}
