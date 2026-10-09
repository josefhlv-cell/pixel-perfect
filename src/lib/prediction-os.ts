/**
 * Prediction OS — hierarchical ensemble and information fusion.
 *
 * This is the orchestration layer. It deliberately treats model outputs as
 * evidence, not truth, and produces a calibrated distribution plus an
 * explainable confidence budget.
 */

export type ModelName="HEDONIC"|"BOOSTING"|"SPATIAL"|"TEMPORAL"|"MACRO"|"BEHAVIORAL";

export interface ModelForecast{
  model:ModelName;
  p10:number;
  p50:number;
  p90:number;
  probabilityGain:number;
  confidence:number;
  dataCoverage:number;
  outOfSampleScore:number;
}

export interface FusionResult{
  p10:number;
  p25:number;
  p50:number;
  p75:number;
  p90:number;
  probabilityGain:number;
  confidence:number;
  agreement:number;
  weights:Record<ModelName,number>;
  weakSignals:string[];
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

function weighted(values:{v:number;w:number}[]){
  const w=values.reduce((s,x)=>s+x.w,0);
  return w?values.reduce((s,x)=>s+x.v*x.w,0)/w:0;
}

function quantile(values:number[],q:number){
  const a=[...values].sort((x,y)=>x-y);
  if(!a.length)return 0;
  const p=clamp(q,0,1)*(a.length-1),lo=Math.floor(p),hi=Math.ceil(p);
  return a[lo]!+(a[hi]!-a[lo]!)*(p-lo);
}

export function fuseModelForecasts(models:ModelForecast[]):FusionResult{
  const names:ModelName[]=["HEDONIC","BOOSTING","SPATIAL","TEMPORAL","MACRO","BEHAVIORAL"];
  const raw=models.map(m=>({
    m,
    w:Math.max(0.001,m.confidence)*Math.max(0.05,m.dataCoverage)*Math.max(0.05,m.outOfSampleScore)
  }));
  const total=raw.reduce((s,x)=>s+x.w,0);
  const weights=Object.fromEntries(names.map(n=>[n,0])) as Record<ModelName,number>;
  raw.forEach(x=>weights[x.m.model]=x.w/Math.max(total,0.001));

  const p50=weighted(raw.map(x=>({v:x.m.p50,w:x.w})));
  const p10=weighted(raw.map(x=>({v:x.m.p10,w:x.w})));
  const p90=weighted(raw.map(x=>({v:x.m.p90,w:x.w})));
  const p25=weighted(raw.map(x=>({v:x.m.p10+(x.m.p50-x.m.p10)*0.5,w:x.w})));
  const p75=weighted(raw.map(x=>({v:x.m.p50+(x.m.p90-x.m.p50)*0.5,w:x.w})));
  const probabilityGain=weighted(raw.map(x=>({v:x.m.probabilityGain,w:x.w})));

  const spread=raw.length>1
    ?Math.sqrt(raw.reduce((s,x)=>s+x.w*(x.m.p50-p50)**2,0)/Math.max(total,0.001))/Math.max(1,Math.abs(p50))
    :0;
  const agreement=clamp(Math.exp(-spread*7),0,1);
  const meanConfidence=weighted(raw.map(x=>({v:x.m.confidence,w:x.w})));
  const coverage=weighted(raw.map(x=>({v:x.m.dataCoverage,w:x.w})));
  const confidence=clamp(meanConfidence*coverage*(0.55+0.45*agreement),0.02,0.98);

  const weakSignals=raw.filter(x=>x.m.confidence<0.45||x.m.outOfSampleScore<0.55).map(x=>x.m.model);

  return {p10,p25,p50,p75,p90,probabilityGain,confidence,agreement,weights,weakSignals};
}

export interface HierarchicalForecast{
  local:FusionResult;
  city:FusionResult;
  region:FusionResult;
  national:FusionResult;
  final:FusionResult;
  reconciliationError:number;
}

/**
 * Hierarchical reconciliation prevents a local forecast from becoming
 * wildly inconsistent with its city/region/national context.
 */
export function reconcileForecasts(
  local:FusionResult,
  city:FusionResult,
  region:FusionResult,
  national:FusionResult
):HierarchicalForecast{
  const raw=[local,city,region,national];
  const scales=[0.48,0.27,0.17,0.08];
  const combine=(key:keyof FusionResult)=>{
    const vals=raw.map((x,i)=>({v:Number(x[key]),w:scales[i]!}));
    return weighted(vals);
  };
  const final={
    ...local,
    p10:combine("p10"),
    p25:combine("p25"),
    p50:combine("p50"),
    p75:combine("p75"),
    p90:combine("p90"),
    probabilityGain:combine("probabilityGain"),
    confidence:combine("confidence"),
    agreement:combine("agreement")
  };
  const reconciliationError=Math.abs(local.p50-final.p50)/Math.max(1,Math.abs(final.p50));
  return {local,city,region,national,final,reconciliationError};
}
