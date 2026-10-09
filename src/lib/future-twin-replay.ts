/**
 * Future Twin Tournament
 *
 * Compares counterfactual shock paths against historical outcomes. Structural
 * simulations are promoted only when their directional and magnitude behavior
 * survives replay.
 */
export interface TwinReplayCase{
 scenarioId:string;
 predictedChange:number;
 actualChange:number;
 lower:number;
 upper:number;
 observedAt:string;
}
export interface TwinReplayScore{
 scenarioId:string;
 cases:number;
 mae:number;
 directionAccuracy:number;
 coverage:number;
 skill:number;
 status:"CALIBRATED"|"PROMISING"|"RESEARCH"|"INSUFFICIENT";
}
const clamp=(x:number,a=0,b=1)=>Math.min(b,Math.max(a,x));

export function scoreFutureTwinReplay(
 cases:TwinReplayCase[],minCases=12
):TwinReplayScore[]{
 const ids=[...new Set(cases.map(x=>x.scenarioId))];
 return ids.map(scenarioId=>{
  const xs=cases.filter(x=>x.scenarioId===scenarioId);
  const mae=xs.length?xs.reduce((s,x)=>s+Math.abs(x.predictedChange-x.actualChange),0)/xs.length:0;
  const direction=xs.length?xs.filter(x=>Math.sign(x.predictedChange)===Math.sign(x.actualChange)).length/xs.length:0;
  const coverage=xs.length?xs.filter(x=>x.actualChange>=x.lower&&x.actualChange<=x.upper).length/xs.length:0;
  const scale=Math.max(1,xs.reduce((s,x)=>s+Math.abs(x.actualChange),0)/Math.max(1,xs.length));
  const skill=clamp(.45*direction+.30*coverage+.25*(1-clamp(mae/scale)));
  return{
   scenarioId,cases:xs.length,mae,directionAccuracy:direction,coverage,skill,
   status:xs.length<minCases?"INSUFFICIENT":skill>=.75?"CALIBRATED":skill>=.55?"PROMISING":"RESEARCH"
  };
 }).sort((a,b)=>b.skill-a.skill);
}
