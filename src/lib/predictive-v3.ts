/**
 * Predictive Intelligence v3 — model governance and future edge.
 *
 * This layer does not pretend that asking-price history is transaction truth.
 * It scores forecasts by out-of-sample performance and reduces confidence when
 * the current feature regime differs from the training regime.
 */

export interface ForecastPoint {
  actual:number;
  predicted:number;
  lower80?:number;
  upper80?:number;
  lower90?:number;
  upper90?:number;
  eventProbability?:number;
  eventOccurred?:boolean;
}

export interface BacktestMetrics {
  sampleCount:number;
  mae:number;
  rmse:number;
  mape:number;
  bias:number;
  directionalAccuracy:number;
  coverage80:number;
  coverage90:number;
  brierScore:number|null;
  logLoss:number|null;
  calibrationError:number|null;
}

const mean=(x:number[])=>x.length?x.reduce((a,b)=>a+b,0)/x.length:0;
const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

export function evaluateForecasts(points:ForecastPoint[]):BacktestMetrics {
  if(!points.length) return {sampleCount:0,mae:0,rmse:0,mape:0,bias:0,directionalAccuracy:0,coverage80:0,coverage90:0,brierScore:null,logLoss:null,calibrationError:null};
  const errors=points.map(p=>p.actual-p.predicted);
  const ape=points.map(p=>Math.abs(p.actual-p.predicted)/Math.max(1,Math.abs(p.actual)));
  const coverage=(lo:keyof ForecastPoint,hi:keyof ForecastPoint)=>{
    const usable=points.filter(p=>typeof p[lo]==="number"&&typeof p[hi]==="number");
    return usable.length?usable.filter(p=>p.actual >= (p[lo] as number) && p.actual <= (p[hi] as number)).length/usable.length:0;
  };
  let directional=0;
  for(let i=1;i<points.length;i++){
    const actual=Math.sign(points[i]!.actual-points[i-1]!.actual);
    const predicted=Math.sign(points[i]!.predicted-points[i-1]!.predicted);
    directional += actual===predicted?1:0;
  }
  const probs=points.filter(p=>p.eventProbability!=null&&p.eventOccurred!=null);
  const brier=probs.length?mean(probs.map(p=>(clamp(p.eventProbability!,0,1)-(p.eventOccurred?1:0))**2)):null;
  const logLoss=probs.length?mean(probs.map(p=>{
    const q=clamp(p.eventProbability!,0.001,0.999);
    return -(p.eventOccurred?Math.log(q):Math.log(1-q));
  })):null;
  const calibration=probs.length?Math.abs(mean(probs.map(p=>p.eventProbability!))-mean(probs.map(p=>p.eventOccurred?1:0))):null;
  return {
    sampleCount:points.length,
    mae:mean(errors.map(Math.abs)),
    rmse:Math.sqrt(mean(errors.map(x=>x*x))),
    mape:mean(ape),
    bias:mean(errors),
    directionalAccuracy:points.length>1?directional/(points.length-1):0,
    coverage80:coverage("lower80","upper80"),
    coverage90:coverage("lower90","upper90"),
    brierScore:brier,
    logLoss,
    calibrationError:calibration
  };
}

export interface ModelCandidate {
  name:string;
  metrics:BacktestMetrics;
  complexityPenalty?:number;
}

export function selectEnsembleWeights(candidates:ModelCandidate[]):Record<string,number>{
  if(!candidates.length) return {};
  const raw=candidates.map(c=>{
    const error=Math.max(0.0001,c.metrics.rmse/Math.max(1,Math.abs(c.metrics.bias)+c.metrics.mae));
    const directional=0.5+0.5*clamp(c.metrics.directionalAccuracy,0,1);
    const calibration=1-clamp(c.metrics.calibrationError??0.25,0,1);
    const penalty=1/(1+(c.complexityPenalty??0));
    return {name:c.name,weight:(directional*calibration/error)*penalty};
  });
  const total=raw.reduce((s,x)=>s+x.weight,0);
  return Object.fromEntries(raw.map(x=>[x.name,total?x.weight/total:1/raw.length]));
}

export interface FutureEdgeInput {
  purchasePrice:number;
  fairValueP50:number;
  fairValueP10:number;
  fairValueP90:number;
  probabilityGain:number;
  probabilityLoss:number;
  probabilityOver10Pct:number;
  probabilityPriceDrop:number;
  liquidity180d:number;
  modelConfidence:number;
  grossYieldBps?:number;
  netYieldBps?:number;
}

export interface FutureEdge {
  score:number;
  upsideBps:number;
  downsideBps:number;
  asymmetricPayoff:number;
  riskAdjustedScore:number;
  conviction:number;
  label:"EXCEPTIONAL"|"STRONG"|"POSITIVE"|"NEUTRAL"|"NEGATIVE"|"UNRELIABLE";
}

export function calculateFutureEdge(x:FutureEdgeInput):FutureEdge{
  if(x.purchasePrice<=0||x.fairValueP50<=0) return {score:0,upsideBps:0,downsideBps:0,asymmetricPayoff:0,riskAdjustedScore:0,conviction:0,label:"UNRELIABLE"};
  const upside=(x.fairValueP90/x.purchasePrice-1)*10000;
  const downside=(x.fairValueP10/x.purchasePrice-1)*10000;
  const asym=(upside*Math.max(0,x.probabilityGain)+downside*Math.max(0,x.probabilityLoss));
  const yieldBonus=((x.netYieldBps??x.grossYieldBps??0)-500)*0.12;
  const riskAdjusted=(asym*0.55+(x.probabilityOver10Pct*10000)*0.25-(x.probabilityPriceDrop*10000)*0.35+yieldBonus)*x.liquidity180d*x.modelConfidence;
  const score=clamp(50+riskAdjusted/100,0,100);
  const conviction=clamp(x.modelConfidence*(0.55+0.45*x.liquidity180d)*(0.5+0.5*x.probabilityGain),0,1);
  const label=conviction<0.35?"UNRELIABLE":score>=85?"EXCEPTIONAL":score>=70?"STRONG":score>=55?"POSITIVE":score>=40?"NEUTRAL":"NEGATIVE";
  return {score,upsideBps:upside,downsideBps:downside,asymmetricPayoff:asym,riskAdjustedScore:riskAdjusted,conviction,label};
}

export function regimeConfidence(base:number,sourceQualityBps:number,backtestDirectional:number,driftBps:number){
  const data=clamp(sourceQualityBps/10000,0,1);
  const validation=clamp(backtestDirectional,0,1);
  const driftPenalty=clamp(driftBps/10000,0,0.5);
  return clamp(base*(0.35+0.35*data+0.30*validation)*(1-driftPenalty),0.03,0.97);
}
