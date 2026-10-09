/**
 * Time Machine Replay — orchestration contract for honest historical forecasting.
 * Every input must be available at cutoff; future observations are excluded.
 */
export interface VintageRow{eventTime:string;availableAt:string;value:number;id:string;}
export interface ReplayWindow{cutoff:string;horizonMonths:number;training:VintageRow[];futureOutcome?:number;}
export interface ReplayForecast{cutoff:string;horizonMonths:number;predicted:number;lower:number;upper:number;modelVersion:string;}
export interface ReplayScore{mae:number;covered:boolean;directionCorrect?:boolean;horizonMonths:number;}
export function pointInTimeRows(rows:VintageRow[],cutoff:string):VintageRow[]{
 const t=Date.parse(cutoff); return rows.filter(x=>Date.parse(x.availableAt)<=t&&Date.parse(x.eventTime)<=t);
}
export function buildReplayWindows(rows:VintageRow[],cutoffs:string[],horizonMonths:number):ReplayWindow[]{
 return cutoffs.map(c=>({cutoff:c,horizonMonths,training:pointInTimeRows(rows,c)}));
}
export function scoreReplay(f:ReplayForecast,outcome:number,previous?:number):ReplayScore{
 const err=Math.abs(f.predicted-outcome);
 return {mae:err,covered:outcome>=f.lower&&outcome<=f.upper,
   directionCorrect:previous===undefined?undefined:Math.sign(f.predicted-previous)===Math.sign(outcome-previous),
   horizonMonths:f.horizonMonths};
}
