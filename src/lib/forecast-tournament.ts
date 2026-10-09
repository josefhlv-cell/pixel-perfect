/**
 * Reality Investor — Forecast Tournament.
 *
 * Independent forecast families compete on the same out-of-sample targets.
 * No model gets to declare itself "best".
 */

export type ForecastFamily="BASELINE"|"HEDONIC"|"BOOSTING"|"SPATIAL"|"TEMPORAL"|"MACRO"|"BEHAVIORAL"|"GRAPH";

export interface ForecastSubmission{
  model:ForecastFamily;
  p10:number;
  p50:number;
  p90:number;
  probabilityPositive:number;
  confidence:number;
}

export interface ForecastOutcome{
  actual:number;
  lower:number;
  upper:number;
}

export interface TournamentScore{
  model:ForecastFamily;
  count:number;
  mae:number;
  rmse:number;
  bias:number;
  coverage90:number;
  brier:number;
  sharpness:number;
  score:number;
  rank:number;
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

/** Pinball loss for quantile forecasts. */
function pinball(actual:number,pred:number,q:number){
  const e=actual-pred;
  return e>=0?q*e:(q-1)*e;
}

/** Interval score rewards narrow calibrated intervals and punishes misses. */
function intervalScore(actual:number,lo:number,hi:number,alpha=0.1){
  return (hi-lo)+(2/alpha)*(lo-actual)*Number(actual<lo)+(2/alpha)*(actual-hi)*Number(actual>hi);
}

export function scoreForecasts(rows:{submission:ForecastSubmission;outcome:ForecastOutcome}[]):TournamentScore[]{
  const models=[...new Set(rows.map(x=>x.submission.model))];
  return models.map(model=>{
    const r=rows.filter(x=>x.submission.model===model);
    const errors=r.map(x=>x.submission.p50-x.outcome.actual);
    const mae=errors.reduce((s,e)=>s+Math.abs(e),0)/Math.max(1,r.length);
    const rmse=Math.sqrt(errors.reduce((s,e)=>s+e*e,0)/Math.max(1,r.length));
    const bias=errors.reduce((s,e)=>s+e,0)/Math.max(1,r.length);
    const coverage=r.filter(x=>x.outcome.actual>=x.submission.p10&&x.outcome.actual<=x.submission.p90).length/Math.max(1,r.length);
    const brier=r.reduce((s,x)=>s+(x.submission.probabilityPositive-(x.outcome.actual>0?1:0))**2,0)/Math.max(1,r.length);
    const sharpness=r.reduce((s,x)=>s+(x.submission.p90-x.submission.p10),0)/Math.max(1,r.length);
    const pinball=r.reduce((s,x)=>s+pinball(x.outcome.actual,x.submission.p10,.1)+pinball(x.outcome.actual,x.submission.p50,.5)+pinball(x.outcome.actual,x.submission.p90,.9),0)/Math.max(1,r.length);
    const interval=r.reduce((s,x)=>s+intervalScore(x.outcome.actual,x.submission.p10,x.submission.p90),0)/Math.max(1,r.length);
    // Lower is better. Scale-free terms prevent unit-dependent domination.
    const scale=Math.max(1,r.reduce((s,x)=>s+Math.abs(x.outcome.actual),0)/Math.max(1,r.length));
    const normalizedError=mae/scale;
    const normalizedInterval=interval/scale;
    const score=1/(1+normalizedError+normalizedInterval/10+brier+Math.abs(coverage-.9)+pinball/scale);
    return {model,count:r.length,mae,rmse,bias,coverage90:coverage,brier,sharpness,score,rank:0};
  }).sort((a,b)=>b.score-a.score).map((x,i)=>({...x,rank:i+1}));
}

export function ensembleWeights(scores:TournamentScore[]){
  const inv=scores.map(s=>1/Math.max(0.001,1-s.score));
  const total=inv.reduce((a,b)=>a+b,0);
  return Object.fromEntries(scores.map((s,i)=>[s.model,inv[i]!/Math.max(total,0.001)])) as Record<ForecastFamily,number>;
}
