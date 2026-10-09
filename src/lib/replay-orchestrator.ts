import {pointInTimeRows,scoreReplay,type VintageRow,type ReplayForecast} from "./time-machine-replay";
export interface ReplayCase{cutoff:string;horizonMonths:number;modelVersion:string;forecast:ReplayForecast;outcome:number;score:{mae:number;covered:boolean;directionCorrect?:boolean};}
export function replayForecastHistory(rows:VintageRow[],forecasts:ReplayForecast[],outcomes:Record<string,number>,previous:Record<string,number>={}):ReplayCase[]{
 return forecasts.flatMap(f=>{const key=f.cutoff+"|"+f.horizonMonths,outcome=outcomes[key];if(!Number.isFinite(outcome)||!pointInTimeRows(rows,f.cutoff).length)return [];
 return [{cutoff:f.cutoff,horizonMonths:f.horizonMonths,modelVersion:f.modelVersion,forecast:f,outcome,score:scoreReplay(f,outcome,previous[key])}];});
}