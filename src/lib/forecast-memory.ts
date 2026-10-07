/**
 * Reality Investor — Forecast Memory.
 *
 * Every forecast becomes a durable contract. The system can later compare the
 * prediction with the realized outcome and learn where it systematically fails.
 */

export type ForecastOutcomeStatus =
  | "PENDING"|"ON_TRACK"|"VERIFIED"|"FAILED"|"INVALIDATED";

export interface ForecastMemory {
  id:string;
  createdAt:string;
  cutoffAt:string;
  horizonMonths:number;
  target:string;
  p10:number;
  p50:number;
  p90:number;
  probabilityPositive:number;
  probabilityNegative:number;
  confidence:number;
  modelVersion:string;
  regime:string;
}

export interface ForecastOutcome {
  id:string;
  realized:number;
  evaluatedAt:string;
  status:ForecastOutcomeStatus;
  errorBps:number;
  percentileRank:number;
  probabilityScore:number;
}

export function evaluateForecastMemory(
  forecast:ForecastMemory,
  realized:number,
  evaluatedAt:string,
):ForecastOutcome{
  const width=Math.max(1,forecast.p90-forecast.p10);
  const percentileRank=Math.max(0,Math.min(1,(realized-forecast.p10)/width));
  const predictedPositive=forecast.probabilityPositive;
  const actualPositive=realized>0?1:0;
  const probabilityScore=(predictedPositive-actualPositive)**2;
  const inside=realized>=forecast.p10&&realized<=forecast.p90;
  const near=inside||Math.abs(realized-forecast.p50)<=width*0.5;
  return {
    id:forecast.id,
    realized,
    evaluatedAt,
    status:inside?"VERIFIED":near?"ON_TRACK":"FAILED",
    errorBps:realized-forecast.p50,
    percentileRank,
    probabilityScore
  };
}

export function rollingForecastSkill(outcomes:ForecastOutcome[],window=50){
  const rows=outcomes.slice(-window);
  if(!rows.length)return {samples:0,meanErrorBps:0,maeBps:0,intervalCoverage:0,brier:0};
  return {
    samples:rows.length,
    meanErrorBps:rows.reduce((s,x)=>s+x.errorBps,0)/rows.length,
    maeBps:rows.reduce((s,x)=>s+Math.abs(x.errorBps),0)/rows.length,
    intervalCoverage:rows.filter(x=>x.status!=="FAILED").length/rows.length,
    brier:rows.reduce((s,x)=>s+x.probabilityScore,0)/rows.length
  };
}
