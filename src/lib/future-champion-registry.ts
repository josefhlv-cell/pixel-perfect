/**
 * Future Champion Registry
 *
 * Maintains contextual champions instead of one global winner.
 * A champion is scoped by horizon, geography density and market regime.
 */
export interface ChampionEvidence{
 modelId:string;
 horizonMonths:number;
 geography:string;
 regime:string;
 robustness:number;
 sampleSize:number;
 lastValidatedAt:string;
 driftRisk:number;
}
export interface ChampionSelection{
 modelId:string|null;
 confidenceCap:number;
 reason:string;
 alternatives:string[];
}
export function selectFutureChampion(
 candidates:ChampionEvidence[],
 context:{horizonMonths:number;geography:string;regime:string},
):ChampionSelection{
 const scored=candidates.map(c=>{
  const horizonFit=Math.max(0,1-Math.abs(c.horizonMonths-context.horizonMonths)/Math.max(1,context.horizonMonths));
  const geoFit=c.geography===context.geography?1:.45;
  const regimeFit=c.regime===context.regime?1:.50;
  const score=.40*c.robustness+.20*horizonFit+.20*geoFit+.20*regimeFit;
  return{c,score};
 }).sort((a,b)=>b.score-a.score);
 const best=scored[0];
 if(!best||best.c.sampleSize<20||best.c.driftRisk>.65)
  return{modelId:null,confidenceCap:.35,reason:"No contextual champion passes evidence or drift gate.",alternatives:scored.slice(0,3).map(x=>x.c.modelId)};
 return{
  modelId:best.c.modelId,
  confidenceCap:Math.min(.95,best.score*(1-best.c.driftRisk*.5)),
  reason:"Champion selected for the current horizon, geography and regime.",
  alternatives:scored.slice(1,4).map(x=>x.c.modelId),
 };
}
