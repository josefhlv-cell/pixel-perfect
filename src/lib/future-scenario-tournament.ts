/**
 * Future Scenario Tournament
 *
 * Tests competing future hypotheses against historical cases. The tournament
 * does not select the "most convincing" narrative; it ranks hypotheses by
 * realized directional skill, calibration and regret after outcomes mature.
 */
export interface ScenarioForecast{
 id:string;
 state:string;
 probability:number;
 expectedChange:number;
 lower:number;
 upper:number;
 issuedAt:string;
}
export interface ScenarioOutcome{state:string;actualChange:number;observedAt:string;}
export interface ScenarioScore{
 state:string;cases:number;hitRate:number;meanAbsoluteError:number;
 coverage:number;logLoss:number;regret:number;skill:number;
 status:"CHAMPION"|"CORE"|"RESEARCH"|"INSUFFICIENT";
}
export interface ScenarioTournamentResult{scores:ScenarioScore[];champion:string|null;audit:string[];}

const clamp=(x:number,a=0,b=1)=>Math.min(b,Math.max(a,x));
const ln=(x:number)=>Math.log(Math.max(1e-9,x));

export function runScenarioTournament(
 forecasts:ScenarioForecast[],outcomes:ScenarioOutcome[],minCases=15
):ScenarioTournamentResult{
 const states=[...new Set(forecasts.map(f=>f.state))],scores:ScenarioScore[]=[];
 for(const state of states){
  const fs=forecasts.filter(f=>f.state===state),rows=fs.map(f=>{
   const o=outcomes.find(x=>Date.parse(x.observedAt)>Date.parse(f.issuedAt)&&x.state===state);
   return o?{f,o}:null;
  }).filter((x):x is {f:ScenarioForecast;o:ScenarioOutcome}=>x!==null);
  if(!rows.length){scores.push({state,cases:0,hitRate:0,meanAbsoluteError:0,coverage:0,logLoss:0,regret:1,skill:0,status:"INSUFFICIENT"});continue;}
  const hit=rows.filter(x=>Math.sign(x.f.expectedChange)===Math.sign(x.o.actualChange)).length/rows.length;
  const mae=rows.reduce((s,x)=>s+Math.abs(x.f.expectedChange-x.o.actualChange),0)/rows.length;
  const coverage=rows.filter(x=>x.o.actualChange>=x.f.lower&&x.o.actualChange<=x.f.upper).length/rows.length;
  const p=rows.map(x=>x.f.probability);
  const logLoss=rows.reduce((s,x,i)=>s-(Math.sign(x.o.actualChange)===Math.sign(x.f.expectedChange)?ln(p[i]!):ln(1-p[i]!)),0)/rows.length;
  const regret=clamp(1-hit+.5*clamp(mae/Math.max(1,Math.abs(rows.reduce((s,x)=>s+x.o.actualChange,0)/rows.length))));
  const sample=clamp(rows.length/minCases);
  const skill=clamp((.35*hit+.30*coverage+.20*(1-clamp(logLoss/3))+.15*(1-regret))*sample);
  scores.push({state,cases:rows.length,hitRate:hit,meanAbsoluteError:mae,coverage,logLoss,regret,skill,
   status:rows.length<minCases?"INSUFFICIENT":skill>=.72?"CHAMPION":skill>=.52?"CORE":"RESEARCH"});
 }
 scores.sort((a,b)=>b.skill-a.skill);
 return{scores,champion:scores.find(x=>x.status==="CHAMPION")?.state??null,audit:[
  "Only matured outcomes score a scenario.",
  "Narrative quality is irrelevant without realized performance.",
  "Coverage, directional skill and regret are scored separately.",
  "Insufficient samples cannot produce a champion."
 ]};
}
