/**
 * Future Generalization Gate
 *
 * Prevents a model from becoming a Future Champion solely because it performs
 * well inside the same time/place it was trained on.
 *
 * A production candidate needs evidence across:
 *  - future time,
 *  - unseen geography,
 *  - both when data allow it.
 */
export interface GeneralizationCase{
 modelId:string;
 fold:"FUTURE_TIME"|"UNSEEN_REGION"|"FUTURE_AND_REGION";
 error:number;
 baselineError:number;
 coverage:number;
 directionalAccuracy:number;
 sampleSize:number;
}
export interface GeneralizationScore{
 modelId:string;
 timeGain:number;
 spatialGain:number;
 jointGain:number;
 coverage:number;
 directionalAccuracy:number;
 robustness:number;
 status:"CHAMPION"|"CORE"|"RESEARCH"|"REJECT";
}
export interface GeneralizationReport{
 scores:GeneralizationScore[];
 champion:string|null;
 audit:string[];
}
const clamp=(x:number,a=0,b=1)=>Math.min(b,Math.max(a,x));

export function evaluateFutureGeneralization(
 cases:GeneralizationCase[],minSamples=20
):GeneralizationReport{
 const ids=[...new Set(cases.map(x=>x.modelId))];
 const scores=ids.map(modelId=>{
  const rows=cases.filter(x=>x.modelId===modelId);
  const gain=(fold:"FUTURE_TIME"|"UNSEEN_REGION"|"FUTURE_AND_REGION")=>{
   const xs=rows.filter(x=>x.fold===fold&&x.sampleSize>=minSamples);
   if(!xs.length)return 0;
   return xs.reduce((s,x)=>s+clamp(1-x.error/Math.max(1e-9,x.baselineError)),0)/xs.length;
  };
  const relevant=rows.filter(x=>x.sampleSize>=minSamples);
  const coverage=relevant.length?relevant.reduce((s,x)=>s+x.coverage,0)/relevant.length:0;
  const direction=relevant.length?relevant.reduce((s,x)=>s+x.directionalAccuracy,0)/relevant.length:0;
  const timeGain=gain("FUTURE_TIME"),spatialGain=gain("UNSEEN_REGION"),jointGain=gain("FUTURE_AND_REGION");
  const robustness=clamp(.30*timeGain+.25*spatialGain+.25*jointGain+.10*coverage+.10*direction);
  const status=relevant.length<3?"RESEARCH":robustness>=.72&&jointGain>.20?"CHAMPION":
    robustness>=.52?"CORE":"REJECT";
  return{modelId,timeGain,spatialGain,jointGain,coverage,directionalAccuracy:direction,robustness,status};
 }).sort((a,b)=>b.robustness-a.robustness);
 return{scores,champion:scores.find(x=>x.status==="CHAMPION")?.modelId??null,audit:[
  "Same-period random accuracy cannot by itself establish future robustness.",
  "Time and spatial generalization are evaluated separately and jointly.",
  "Small folds cannot promote a model to Champion.",
  "Coverage and directional skill remain separate from point-error improvement."
 ]};
}
