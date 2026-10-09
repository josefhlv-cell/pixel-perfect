/**
 * Reality Investor — Model Lab.
 *
 * Purpose: a real, executable forecasting tournament over point-in-time market
 * observations. It deliberately starts with transparent baselines so future
 * CatBoost/XGBoost/spatial models must beat them out-of-sample rather than merely
 * look sophisticated.
 *
 * No random CV: every score is chronological and only uses information available
 * before the forecast origin.
 */

export interface LabObservation {
  date: string;
  priceM2: number;
  listings?: number | null;
}

export interface LabForecast {
  origin: string;
  targetDate: string;
  actualGrowthBps: number;
  predictedGrowthBps: number;
  lower90Bps: number;
  upper90Bps: number;
  p10Bps: number;
  p50Bps: number;
  p90Bps: number;
  model: string;
}

export interface LabMetrics {
  model: string;
  samples: number;
  maeBps: number;
  rmseBps: number;
  biasBps: number;
  directionalAccuracy: number;
  coverage90: number;
  intervalScore90Bps: number;
  pinballP10Bps: number;
  pinballP50Bps: number;
  pinballP90Bps: number;
  compositeScore: number;
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));
const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const median=(xs:number[])=>{
  if(!xs.length)return 0;
  const a=[...xs].sort((x,y)=>x-y);
  const m=Math.floor(a.length/2);
  return a.length%2?a[m]!:((a[m-1]!+a[m]!)/2);
};

function growthBps(from:number,to:number){
  return from>0?((to/from)-1)*10000:0;
}

function quantile(xs:number[],q:number){
  if(!xs.length)return 0;
  const a=[...xs].sort((x,y)=>x-y);
  const p=(a.length-1)*q;
  const lo=Math.floor(p), hi=Math.ceil(p);
  if(lo===hi)return a[lo]!;
  return a[lo]!+(a[hi]!-a[lo]!)*(p-lo);
}

function robustScale(xs:number[]){
  if(xs.length<3)return 100;
  const med=median(xs);
  const mad=median(xs.map(x=>Math.abs(x-med)));
  return Math.max(50,1.4826*mad);
}

function historicalGrowths(rows:LabObservation[], originIndex:number, lookback=24){
  const start=Math.max(1,originIndex-lookback+1);
  const out:number[]=[];
  for(let i=start;i<=originIndex;i++){
    out.push(growthBps(rows[i-1]!.priceM2,rows[i]!.priceM2));
  }
  return out;
}

function momentumForecast(rows:LabObservation[],i:number):number{
  const g=historicalGrowths(rows,i,6);
  if(!g.length)return 0;
  const weights=g.map((_,k)=>k+1);
  return clamp(g.reduce((s,x,k)=>s+x*weights[k]!,0)/weights.reduce((a,b)=>a+b,0),-2500,2500);
}

function meanReversionForecast(rows:LabObservation[],i:number):number{
  const g=historicalGrowths(rows,i,12);
  if(!g.length)return 0;
  const recent=mean(g.slice(-3));
  const long=mean(g);
  return clamp(long+(recent-long)*0.35,-2500,2500);
}

function inventoryAdjustedForecast(rows:LabObservation[],i:number):number{
  const base=momentumForecast(rows,i);
  const now=rows[i]?.listings;
  const prev=rows[Math.max(0,i-1)]?.listings;
  if(now==null||prev==null||prev<=0)return base;
  const inventoryGrowth=(now/prev)-1;
  return clamp(base-inventoryGrowth*1800,-3000,3000);
}

function interval(rows:LabObservation[],i:number,pred:number){
  const g=historicalGrowths(rows,i,18);
  const scale=robustScale(g);
  return {lower90Bps:pred-1.645*scale,upper90Bps:pred+1.645*scale};
}

function target(rows:LabObservation[],i:number,horizon=1){
  const j=i+horizon;
  if(j>=rows.length)return null;
  return growthBps(rows[i]!.priceM2,rows[j]!.priceM2);
}

function pinball(actual:number,pred:number,q:number){
  const e=actual-pred;
  return Math.max(q*e,(q-1)*e);
}

function intervalScore(actual:number,lo:number,hi:number,alpha=0.1){
  const width=hi-lo;
  const below=actual<lo?(2/alpha)*(lo-actual):0;
  const above=actual>hi?(2/alpha)*(actual-hi):0;
  return width+below+above;
}

export function runModelLab(
  observations:LabObservation[],
  opts:{horizonMonths?:number;minHistory?:number;step?:number}={}
):{forecasts:LabForecast[];metrics:LabMetrics[]}{
  const rows=[...observations]
    .filter(x=>Number.isFinite(x.priceM2)&&x.priceM2>0)
    .sort((a,b)=>a.date.localeCompare(b.date));
  const horizon=opts.horizonMonths??1;
  const minHistory=opts.minHistory??12;
  const step=opts.step??1;
  const names=["naive","momentum","mean-reversion","inventory-adjusted"];
  const forecasts:LabForecast[]=[];

  for(let i=minHistory;i+horizon<rows.length;i+=step){
    const actual=target(rows,i,horizon);
    if(actual==null)continue;
    const predictions:Record<string,number>={
      naive:historicalGrowths(rows,i,1)[0]??0,
      momentum:momentumForecast(rows,i),
      "mean-reversion":meanReversionForecast(rows,i),
      "inventory-adjusted":inventoryAdjustedForecast(rows,i),
    };
    for(const model of names){
      const pred=predictions[model]!;
      const {lower90Bps,upper90Bps}=interval(rows,i,pred);
      const scale=robustScale(historicalGrowths(rows,i,18));
      const p10Bps=pred-1.2816*scale;
      const p90Bps=pred+1.2816*scale;
      forecasts.push({
        origin:rows[i]!.date,
        targetDate:rows[i+horizon]!.date,
        actualGrowthBps:actual,
        predictedGrowthBps:pred,
        lower90Bps,
        upper90Bps,
        p10Bps,
        p50Bps:pred,
        p90Bps,
        model,
      });
    }
  }

  const metrics=names.map(model=>{
    const f=forecasts.filter(x=>x.model===model);
    const errors=f.map(x=>x.actualGrowthBps-x.predictedGrowthBps);
    const coverage=f.length?f.filter(x=>x.actualGrowthBps>=x.lower90Bps&&x.actualGrowthBps<=x.upper90Bps).length/f.length:0;
    const directional=f.length>0?f.filter(x=>Math.sign(x.actualGrowthBps)===Math.sign(x.predictedGrowthBps)).length/f.length:0;
    const mae=mean(errors.map(Math.abs));
    const rmse=Math.sqrt(mean(errors.map(x=>x*x)));
    const bias=mean(errors);
    const intervalAvg=mean(f.map(x=>intervalScore(x.actualGrowthBps,x.lower90Bps,x.upper90Bps)));
    const p10=mean(f.map(x=>pinball(x.actualGrowthBps,x.p10Bps,0.1)));
    const p50=mean(f.map(x=>pinball(x.actualGrowthBps,x.p50Bps,0.5)));
    const p90=mean(f.map(x=>pinball(x.actualGrowthBps,x.p90Bps,0.9)));
    // Lower is better. Composite is intentionally dominated by OOS error and
    // penalizes overconfident/poorly covered intervals.
    const coveragePenalty=Math.abs(coverage-0.90)*2000;
    const composite=mae+0.35*intervalAvg+coveragePenalty+0.25*Math.abs(bias);
    return {model,samples:f.length,maeBps:mae,rmseBps:rmse,biasBps:bias,directionalAccuracy:directional,coverage90:coverage,intervalScore90Bps:intervalAvg,pinballP10Bps:p10,pinballP50Bps:p50,pinballP90Bps:p90,compositeScore:composite};
  }).sort((a,b)=>a.compositeScore-b.compositeScore);

  return {forecasts,metrics};
}

export function championFromLab(metrics:LabMetrics[]){
  return [...metrics].sort((a,b)=>a.compositeScore-b.compositeScore)[0]??null;
}
