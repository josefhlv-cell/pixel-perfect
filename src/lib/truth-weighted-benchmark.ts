/**
 * Reality Investor — Truth-Weighted Forecast Benchmark.
 *
 * Scores forecasts against a hierarchy of outcomes. Transaction outcomes
 * receive the highest validation weight, official indices second, and proxy
 * outcomes are never allowed to masquerade as transaction truth.
 */

import type {TruthLevel} from "./truth-layer";

export interface BenchmarkForecast {
  id:string;
  model:string;
  cutoff:string;
  targetPeriod:string;
  p10:number;
  p50:number;
  p90:number;
  probabilityPositive:number;
}

export interface BenchmarkOutcome {
  forecastId:string;
  realizedGrowth:number;
  truthLevel:TruthLevel;
  availableAt:string;
}

export interface TruthWeightedScore {
  model:string;
  n:number;
  transactionN:number;
  officialN:number;
  proxyN:number;
  weightedMae:number|null;
  weightedRmse:number|null;
  coverage90:number|null;
  brier:number|null;
  validationClass:"TRANSACTION_GROUNDED"|"OFFICIAL_GROUNDED"|"PROXY_ONLY"|"INSUFFICIENT";
}

const weight:Record<TruthLevel,number>={
  TRANSACTION:1,
  OFFICIAL_INDEX:.85,
  ASKING:.55,
  RENT:.50,
  BEHAVIORAL:.35,
  MACRO:.30,
  SENTIMENT:.15,
};

export function truthWeightedBenchmark(
  forecasts:BenchmarkForecast[],
  outcomes:BenchmarkOutcome[],
  minTransactionOutcomes=12,
):TruthWeightedScore[]{
  const byId=new Map(outcomes.map(o=>[o.forecastId,o]));
  const models=[...new Set(forecasts.map(f=>f.model))];
  return models.map(model=>{
    const rows=forecasts
      .filter(f=>f.model===model)
      .map(f=>({f,o:byId.get(f.id)}))
      .filter((x):x is {f:BenchmarkForecast;o:BenchmarkOutcome}=>Boolean(x.o));
    const transactionN=rows.filter(x=>x.o.truthLevel==="TRANSACTION").length;
    const officialN=rows.filter(x=>x.o.truthLevel==="OFFICIAL_INDEX").length;
    const proxyN=rows.length-transactionN-officialN;
    if(rows.length===0){
      return {model,n:0,transactionN,officialN,proxyN,weightedMae:null,weightedRmse:null,coverage90:null,brier:null,validationClass:"INSUFFICIENT" as const};
    }
    const weights=rows.map(x=>weight[x.o.truthLevel]);
    const total=weights.reduce((a,b)=>a+b,0);
    const errors=rows.map(x=>x.f.p50-x.o.realizedGrowth);
    const weightedMae=errors.reduce((s,e,i)=>s+Math.abs(e)*weights[i]!,0)/total;
    const weightedRmse=Math.sqrt(errors.reduce((s,e,i)=>s+e*e*weights[i]!,0)/total);
    const coverage90=rows.reduce((s,x,i)=>
      s+(x.o.realizedGrowth>=x.f.p10&&x.o.realizedGrowth<=x.f.p90?weights[i]!:0),0)/total;
    const brier=rows.reduce((s,x,i)=>
      s+Math.pow(x.f.probabilityPositive-(x.o.realizedGrowth>0?1:0),2)*weights[i]!,0)/total;
    const validationClass=transactionN>=minTransactionOutcomes
      ?"TRANSACTION_GROUNDED"
      :officialN>0
        ?"OFFICIAL_GROUNDED"
        :"PROXY_ONLY";
    return {model,n:rows.length,transactionN,officialN,proxyN,weightedMae,weightedRmse,coverage90,brier,validationClass};
  });
}
