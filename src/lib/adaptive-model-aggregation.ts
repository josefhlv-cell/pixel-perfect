/**
 * Reality Investor — Adaptive Model Aggregation.
 *
 * Online model selection is fragile under regime changes. This layer therefore
 * keeps a portfolio of model families and updates their weights from delayed,
 * out-of-sample feedback. It can freeze adaptation when evidence is too weak.
 *
 * This is an implementation of the architecture, not a claim of conformal
 * coverage by itself. Formal coverage requires conformal input sets and their
 * assumptions to be satisfied.
 */

export interface OnlineModel {
  name:string;
  weight:number;
  cumulativeLoss:number;
  observations:number;
  lastLoss:number|null;
}

export interface ModelFeedback {
  model:string;
  loss:number;
  availableAt:string;
  horizonMonths:number;
}

export interface AggregatedForecast {
  p10:number;
  p50:number;
  p90:number;
  confidence:number;
  weights:Record<string,number>;
  adaptationRate:number;
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

function normalize(models:OnlineModel[]){
  const total=models.reduce((s,m)=>s+Math.max(1e-9,m.weight),0);
  return models.map(m=>({...m,weight:Math.max(1e-9,m.weight)/total}));
}

export function initializeModelPortfolio(names:string[]):OnlineModel[]{
  const w=1/Math.max(1,names.length);
  return names.map(name=>({
    name,weight:w,cumulativeLoss:0,observations:0,lastLoss:null
  }));
}

/**
 * Multiplicative-weights update. A model that repeatedly loses receives less
 * capital; a model that improves receives more. Losses are clipped to avoid one
 * extreme market shock destroying the entire portfolio.
 */
export function updateModelPortfolio(
  models:OnlineModel[],
  feedback:ModelFeedback[],
  opts:{learningRate?:number;minWeight?:number;maxWeight?:number;adaptationGate?:number}={}
):OnlineModel[]{
  const eta=opts.learningRate??0.08;
  const minWeight=opts.minWeight??0.02;
  const maxWeight=opts.maxWeight??0.70;
  const gate=opts.adaptationGate??0.50;

  if(!feedback.length)return normalize(models);

  const byModel=new Map<string,ModelFeedback[]>();
  for(const f of feedback){
    const rows=byModel.get(f.model)??[];
    rows.push(f); byModel.set(f.model,rows);
  }

  const usable=feedback.filter(f=>Number.isFinite(f.loss));
  if(!usable.length)return normalize(models);
  const medianLoss=[...usable].sort((a,b)=>a.loss-b.loss)[Math.floor(usable.length/2)]!.loss;

  const raw=models.map(m=>{
    const rows=byModel.get(m.name)??[];
    if(!rows.length)return {...m};
    const loss=rows.reduce((s,f)=>s+Math.max(0,Math.min(1,f.loss)),0)/rows.length;
    const centered=loss-medianLoss;
    const gateConfidence=clamp(rows.length/Math.max(5,usable.length),0,1);
    const effectiveEta=eta*gateConfidence*clamp(gate,0,1);
    const weight=m.weight*Math.exp(-effectiveEta*centered*10);
    return {
      ...m,
      weight:clamp(weight,minWeight,maxWeight),
      cumulativeLoss:m.cumulativeLoss+loss*rows.length,
      observations:m.observations+rows.length,
      lastLoss:loss
    };
  });
  return normalize(raw);
}

export function aggregateForecast(
  forecasts:Array<{model:string;p10:number;p50:number;p90:number;confidence:number}>,
  portfolio:OnlineModel[],
):AggregatedForecast{
  if(!forecasts.length)return {p10:0,p50:0,p90:0,confidence:0,weights:{},adaptationRate:0};

  const byName=new Map(portfolio.map(m=>[m.name,m]));
  const usable=forecasts.filter(f=>byName.has(f.model));
  if(!usable.length)return {p10:0,p50:0,p90:0,confidence:0,weights:{},adaptationRate:0};

  const total=usable.reduce((s,f)=>s+Math.max(1e-9,byName.get(f.model)!.weight),0);
  const w=(f:{model:string})=>Math.max(1e-9,byName.get(f.model)!.weight)/total;

  const p10=usable.reduce((s,f)=>s+w(f)*f.p10,0);
  const p50=usable.reduce((s,f)=>s+w(f)*f.p50,0);
  const p90=usable.reduce((s,f)=>s+w(f)*f.p90,0);
  const confidence=clamp(
    usable.reduce((s,f)=>s+w(f)*clamp(f.confidence,0,1),0),
    0,1
  );

  const entropy=usable.reduce((s,f)=>s-w(f)*Math.log(Math.max(1e-9,w(f))),0);
  const maxEntropy=Math.log(Math.max(1,usable.length));
  const adaptationRate=maxEntropy>0?1-entropy/maxEntropy:1;

  return {
    p10,p50,p90,confidence,
    weights:Object.fromEntries(usable.map(f=>[f.model,w(f)])),
    adaptationRate
  };
}

/**
 * Delayed feedback guard: a 12-month forecast cannot update its weights before
 * its 12-month outcome becomes available.
 */
export function eligibleFeedback(
  feedback:ModelFeedback[],
  now:string,
  issuedAtByModel:Record<string,string>,
):ModelFeedback[]{
  const t=Date.parse(now);
  return feedback.filter(f=>{
    const issued=issuedAtByModel[f.model];
    if(!issued)return false;
    return Date.parse(f.availableAt)<=t && Date.parse(f.availableAt)>=Date.parse(issued);
  });
}
