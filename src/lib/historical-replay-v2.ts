import {pointInTimeRows,type VintageRow} from "./time-machine-replay";
import {buildForecastVintage,type DataVintage,type ForecastVintage} from "./forecast-vintage-ledger";

export interface HistoricalReplayCase{
 id:string; cutoff:string; horizonMonths:number; trainingRows:number;
 predicted:number; lower:number; upper:number; outcome:number;
 absoluteError:number; covered:boolean; vintage:ForecastVintage;
}
export interface HistoricalReplayInput{
 rows:VintageRow[]; vintages:DataVintage[]; cutoffs:string[]; horizonMonths:number;
 forecast:(training:VintageRow[],cutoff:string)=>{predicted:number;lower:number;upper:number;modelVersion:string};
 outcome:(cutoff:string,horizonMonths:number)=>number|null;
}
export interface HistoricalReplayReport{
 cases:HistoricalReplayCase[]; pointInTimeIntegrity:boolean;
 meanAbsoluteError:number; intervalCoverage:number; directionAccuracy:number; audit:string[];
}
export function runHistoricalReplayV2(x:HistoricalReplayInput):HistoricalReplayReport{
 const cases:HistoricalReplayCase[]=[]; let integrity=true;
 for(const cutoff of x.cutoffs){
  const training=pointInTimeRows(x.rows,cutoff);
  const f=x.forecast(training,cutoff);
  const outcome=x.outcome(cutoff,x.horizonMonths);
  if(outcome===null||!Number.isFinite(outcome))continue;
  const vintage=buildForecastVintage(cutoff,cutoff,"historical-replay-v2",training.map(r=>r.id),x.vintages,f.modelVersion);
  if(training.some(r=>Date.parse(r.availableAt)>Date.parse(cutoff)))integrity=false;
  cases.push({id:"hr2-"+cutoff,cutoff,horizonMonths:x.horizonMonths,trainingRows:training.length,
   predicted:f.predicted,lower:f.lower,upper:f.upper,outcome,absoluteError:Math.abs(f.predicted-outcome),
   covered:outcome>=f.lower&&outcome<=f.upper,vintage});
 }
 const mae=cases.length?cases.reduce((s,c)=>s+c.absoluteError,0)/cases.length:0;
 const coverage=cases.length?cases.filter(c=>c.covered).length/cases.length:0;
 const direction=cases.length?cases.filter(c=>Math.sign(c.predicted)===Math.sign(c.outcome)).length/cases.length:0;
 return{cases,pointInTimeIntegrity:integrity,meanAbsoluteError:mae,intervalCoverage:coverage,directionAccuracy:direction,
  audit:["Only information available at each historical cutoff is used.","Later outcomes are evaluation only.","Forecast vintages remain reproducible.","Accuracy, coverage and direction are scored separately."]};
}
