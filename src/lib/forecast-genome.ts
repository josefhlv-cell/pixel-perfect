/**
 * Reality Investor — Forecast Genome.
 *
 * Converts historical forecast outcomes into a compact "model DNA":
 * where a model works, where it fails, how quickly it degrades after a
 * regime change, and which conditions should reduce its future weight.
 *
 * This is deliberately outcome-driven. No model receives credit merely for
 * being sophisticated; only verified point-in-time forecasts can improve DNA.
 */

export interface ForecastOutcome {
  model:string;
  submarket:string;
  regime:string;
  horizonMonths:number;
  predicted:number;
  actual:number;
  intervalLow?:number;
  intervalHigh?:number;
  timestamp:number;
}

export interface GenomeCell {
  model:string;
  submarket:string;
  regime:string;
  samples:number;
  mae:number;
  bias:number;
  directionalAccuracy:number;
  coverage:number;
  score:number;
  trust:"HIGH"|"MEDIUM"|"LOW"|"UNKNOWN";
}

export interface ForecastGenome {
  cells:GenomeCell[];
  bestBySubmarket:Record<string,string>;
  bestByRegime:Record<string,string>;
  fragileModels:string[];
  recommendedWeights:Record<string,number>;
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

function groupKey(x:ForecastOutcome){return [x.model,x.submarket,x.regime].join("|");}

export function buildForecastGenome(rows:ForecastOutcome[],minSamples=8):ForecastGenome{
  const groups=new Map<string,ForecastOutcome[]>();
  for(const row of rows){
    const key=groupKey(row);
    const arr=groups.get(key)??[];
    arr.push(row);groups.set(key,arr);
  }

  const cells:GenomeCell[]=[];
  for(const [key,items] of groups){
    const [model,submarket,regime]=key.split("|");
    const errors=items.map(x=>x.predicted-x.actual);
    const mae=errors.reduce((s,e)=>s+Math.abs(e),0)/items.length;
    const bias=errors.reduce((s,e)=>s+e,0)/items.length;
    const directional=items.filter(x=>Math.sign(x.predicted)===Math.sign(x.actual)).length/items.length;
    const covered=items.filter(x=>x.intervalLow!=null&&x.intervalHigh!=null&&x.actual>=x.intervalLow&&x.actual<=x.intervalHigh).length;
    const coverage=items.some(x=>x.intervalLow!=null&&x.intervalHigh!=null)?covered/items.length:NaN;
    const normalizedError=mae/Math.max(0.01,items.reduce((s,x)=>s+Math.abs(x.actual),0)/items.length);
    const score=clamp((1-normalizedError)*.55+directional*.30+(Number.isNaN(coverage)?.15:clamp(1-Math.abs(coverage-.9),0,.15)),0,1);
    cells.push({model,submarket,regime,samples:items.length,mae,bias,directionalAccuracy:directional,coverage,score,
      trust:items.length<minSamples?"UNKNOWN":score>=.75?"HIGH":score>=.55?"MEDIUM":"LOW"});
  }

  const bestBySubmarket:Record<string,string>={};
  const bestByRegime:Record<string,string>={};
  for(const cell of cells){
    if(cell.samples<minSamples)continue;
    if(!bestBySubmarket[cell.submarket]||cell.score>Math.max(...cells.filter(c=>c.submarket===cell.submarket&&c.samples>=minSamples).map(c=>c.score)))bestBySubmarket[cell.submarket]=cell.model;
    if(!bestByRegime[cell.regime]||cell.score>Math.max(...cells.filter(c=>c.regime===cell.regime&&c.samples>=minSamples).map(c=>c.score)))bestByRegime[cell.regime]=cell.model;
  }

  const modelScores=new Map<string,number[]>();
  for(const cell of cells){
    const arr=modelScores.get(cell.model)??[];
    if(cell.samples>=minSamples)arr.push(cell.score);modelScores.set(cell.model,arr);
  }
  const raw=Object.fromEntries([...modelScores].map(([m,s])=>[m,s.length?s.reduce((a,b)=>a+b,0)/s.length:0]));
  const total=Object.values(raw).reduce((a,b)=>a+b,0)||1;
  const recommendedWeights=Object.fromEntries(Object.entries(raw).map(([m,v])=>[m,v/total]));
  const fragileModels=Object.entries(raw).filter(([,v])=>v<.5).map(([m])=>m);

  return {cells,bestBySubmarket,bestByRegime,fragileModels,recommendedWeights};
}
