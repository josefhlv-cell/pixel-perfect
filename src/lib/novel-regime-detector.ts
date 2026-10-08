/**
 * Novel Regime Detector
 *
 * Detects when the current feature configuration is unlike the historical
 * states used to train/validate a model. It is a novelty detector, not a
 * prediction of the future.
 */
export interface RegimeVector{
 id:string;
 time:string;
 features:number[];
 regime?:string;
}
export interface NovelRegimeResult{
 novelty:number;
 nearestDistance:number;
 percentileRank:number;
 status:"KNOWN"|"NOVEL"|"UNKNOWN_REGIME";
 closestId:string|null;
 confidenceCap:number;
 reasons:string[];
}
const distance=(a:number[],b:number[])=>{
 const n=Math.min(a.length,b.length);
 if(!n)return Infinity;
 let s=0;
 for(let i=0;i<n;i++){const d=(a[i]??0)-(b[i]??0);s+=d*d;}
 return Math.sqrt(s/n);
};
const clamp=(x:number,a=0,b=1)=>Math.min(b,Math.max(a,x));

export function detectNovelRegime(
 current:RegimeVector,
 history:RegimeVector[],
):NovelRegimeResult{
 if(!history.length)return{novelty:1,nearestDistance:Infinity,percentileRank:1,status:"UNKNOWN_REGIME",closestId:null,confidenceCap:.25,reasons:["No historical regime reference"]};
 const distances=history.map(h=>({id:h.id,d:distance(current.features,h.features)})).sort((a,b)=>a.d-b.d);
 const nearest=distances[0]!;
 const all=distances.map(x=>x.d);
 const rank=all.filter(d=>d<=nearest.d).length/Math.max(1,all.length);
 const mean=all.reduce((s,x)=>s+x,0)/all.length;
 const variance=all.reduce((s,x)=>s+(x-mean)**2,0)/all.length;
 const sd=Math.sqrt(variance);
 const z=sd>1e-9?(nearest.d-mean)/sd:0;
 const novelty=clamp(.65*clamp(z/3)+.35*rank);
 const status=novelty>=.82?"UNKNOWN_REGIME":novelty>=.60?"NOVEL":"KNOWN";
 const confidenceCap=status==="UNKNOWN_REGIME"?.35:status==="NOVEL"?.60:.95;
 return{
  novelty,nearestDistance:nearest.d,percentileRank:rank,status,
  closestId:nearest.id,confidenceCap,
  reasons:status==="UNKNOWN_REGIME"
   ?["Current feature configuration is outside the historical neighborhood.","Reduce trust in historical champions.","Prioritize new observations and replay."]
   :status==="NOVEL"
   ?["Current state is unusual relative to historical examples.","Use contextual validation before strong decisions."]
   :["Current state has historical analogues."]
 };
}
