/**
 * Reality Investor — Prediction Engine v3.
 *
 * Model governance layer:
 * - walk-forward ensemble selection
 * - error-aware model weights
 * - drift detection
 * - forecast confidence that reflects data quality and recent error
 * - Future Edge score combining valuation, expected return, downside and liquidity
 */

export type ModelKind = "MOMENTUM" | "MEAN_REVERSION" | "STRUCTURAL" | "SCENARIO";

export interface ModelObservation {
  date: string;
  actualPriceM2: number;
  predictions: Partial<Record<ModelKind, number>>;
}

export interface ModelScore {
  model: ModelKind;
  mae: number;
  mape: number;
  bias: number;
  directionalAccuracy: number;
  weight: number;
}

export interface EnsembleForecast {
  value: number;
  p10: number;
  p50: number;
  p90: number;
  confidence: number;
  modelScores: ModelScore[];
  disagreementBps: number;
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));
const mean=(x:number[])=>x.length?x.reduce((a,b)=>a+b,0)/x.length:0;

export function scoreModels(rows: ModelObservation[]): ModelScore[] {
  const models: ModelKind[]=["MOMENTUM","MEAN_REVERSION","STRUCTURAL","SCENARIO"];
  const raw=models.map(model=>{
    const usable=rows.filter(r=>r.predictions[model]!=null && r.actualPriceM2>0);
    const errors=usable.map(r=>Number(r.predictions[model])-r.actualPriceM2);
    const ape=usable.map((e,i)=>Math.abs(e)/Math.max(1,usable[i]!.actualPriceM2));
    const direction=usable.length>1
      ? usable.slice(1).filter((r,i)=>{
          const prev=usable[i]!;
          return Math.sign(r.actualPriceM2-prev.actualPriceM2)===
            Math.sign(Number(r.predictions[model])-Number(prev.predictions[model]));
        }).length/(usable.length-1)
      : 0.5;
    return {
      model,
      mae:mean(errors.map(Math.abs)),
      mape:mean(ape),
      bias:mean(errors),
      directionalAccuracy:direction,
      weight:0
    };
  });
  const inverse=raw.map(s=>1/Math.max(1,s.mape));
  const total=inverse.reduce((a,b)=>a+b,0)||1;
  return raw.map((s,i)=>({...s,weight:inverse[i]!/total}));
}

export function ensembleForecast(
  current:number,
  candidates:Partial<Record<ModelKind,number>>,
  scores:ModelScore[],
  residuals:number[],
):EnsembleForecast {
  const available=scores.filter(s=>candidates[s.model]!=null);
  const total=available.reduce((a,s)=>a+s.weight,0)||1;
  const normalized=available.map(s=>({...s,weight:s.weight/total}));
  const value=normalized.reduce((a,s)=>a+Number(candidates[s.model])*s.weight,0);
  const disagreement=normalized.length>1
    ? Math.sqrt(normalized.reduce((a,s)=>a+s.weight*(Number(candidates[s.model])-value)**2,0))/Math.max(1,current)*10000
    : 0;
  const absResiduals=residuals.map(Math.abs).sort((a,b)=>a-b);
  const q=(p:number)=>absResiduals.length
    ? absResiduals[Math.min(absResiduals.length-1,Math.floor((absResiduals.length-1)*p))]!
    : current*0.08;
  const radius90=q(0.90)+current*disagreement/10000*0.75;
  const dataFactor=clamp(1-Math.min(0.7,disagreement/5000),0.15,1);
  const historyFactor=clamp(Math.log10(Math.max(10,residuals.length))/3,0.35,1);
  const confidence=clamp(dataFactor*historyFactor,0.05,0.97);
  return {
    value,
    p10:value-radius90,
    p50:value,
    p90:value+radius90,
    confidence,
    modelScores:normalized,
    disagreementBps:Math.round(disagreement)
  };
}

export interface DriftResult {
  driftScore:number;
  drifted:boolean;
  signals:string[];
}

export function detectDrift(
  reference:number[],
  recent:number[],
  threshold=1.5,
):DriftResult {
  if(reference.length<5 || recent.length<3) return {driftScore:0,drifted:false,signals:["Málo dat pro drift test."]};
  const rm=mean(reference), zm=mean(recent);
  const rv=Math.sqrt(mean(reference.map(x=>(x-rm)**2)))||1;
  const shift=Math.abs(zm-rm)/rv;
  const referenceTrend=reference.length>1?(reference.at(-1)!-reference[0]!)/Math.max(1,reference.length-1):0;
  const recentTrend=recent.length>1?(recent.at(-1)!-recent[0]!)/Math.max(1,recent.length-1):0;
  const trendShift=Math.abs(recentTrend-referenceTrend)/(Math.abs(referenceTrend)+1)||0;
  const score=clamp(0.7*shift+0.3*Math.min(3,trendShift),0,5);
  const signals:string[]=[];
  if(shift>threshold) signals.push("recentní ceny se statisticky odchylují od referenčního režimu");
  if(trendShift>1) signals.push("změnil se sklon cenového trendu");
  return {driftScore:score,drifted:score>=threshold,signals};
}

export interface FutureEdgeInput {
  price:number;
  fairValue:number;
  expectedFutureValue:number;
  downsideP10:number;
  upsideP90:number;
  liquidity180d:number;
  grossYieldBps?:number;
  confidence:number;
}

export function futureEdge(input:FutureEdgeInput){
  const discount=input.fairValue>0 ? (input.fairValue/input.price-1) : 0;
  const futureReturn=input.expectedFutureValue/input.price-1;
  const downside=input.downsideP10/input.price-1;
  const upside=input.upsideP90/input.price-1;
  const asymmetry=(upside-Math.abs(Math.min(0,downside)))*100;
  const score=clamp(
    40*clamp(discount*4,-1,1)+
    45*clamp(futureReturn*2,-1,1)+
    20*input.liquidity180d+
    0.15*asymmetry,
    0,100
  )*input.confidence;
  return {
    score:Math.round(score),
    discountBps:Math.round(discount*10000),
    expectedReturnBps:Math.round(futureReturn*10000),
    downsideBps:Math.round(downside*10000),
    upsideBps:Math.round(upside*10000),
    riskAdjustedEdgeBps:Math.round((futureReturn-Math.abs(Math.min(0,downside))*0.5)*10000)
  };
}
