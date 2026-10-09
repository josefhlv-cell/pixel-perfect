/**
 * Adaptive Forecast Constitution — selects the forecasting strategy itself.
 *
 * The system should not assume that one model family is globally superior.
 * Strategy selection is contextual: market regime, sample size, spatial
 * density, volatility, drift and historical OOS performance determine whether
 * the next forecast should be LOCAL, CONNECTED, ENSEMBLE or CAUTIOUS.
 */
export type ForecastStrategy="LOCAL"|"CONNECTED"|"ENSEMBLE"|"CAUTIOUS";
export interface StrategyEvidence{
  strategy:ForecastStrategy;
  oosLoss:number;
  directionalAccuracy:number;
  calibration:number;
  sampleSize:number;
  regimeMatch:number;
  spatialMatch:number;
}
export interface StrategySelection{
  strategy:ForecastStrategy;
  confidence:number;
  ranked:StrategyEvidence[];
  reason:string[];
}
const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

export function selectForecastStrategy(
  candidates:StrategyEvidence[],
  context:{driftRisk:number;modelDisagreement:number;spatialDensity:number},
):StrategySelection{
  const ranked=[...candidates].map(x=>{
    const lossScore=1/(1+Math.max(0,x.oosLoss));
    const sample=clamp(x.sampleSize/100,0,1);
    const score=.32*lossScore+.20*x.directionalAccuracy+.18*x.calibration+
      .12*sample+.10*x.regimeMatch+.08*x.spatialMatch;
    return {...x,oosLoss:Math.max(0,x.oosLoss),_score:score};
  }).sort((a,b)=>b._score-a._score);

  const best=ranked[0];
  const reason:string[]=[];
  if(!best)return{strategy:"CAUTIOUS",confidence:0,ranked:[],reason:["no strategy evidence"]};
  if(context.driftRisk>.65){reason.push("high concept drift");return{strategy:"CAUTIOUS",confidence:.25,ranked,reason};}
  if(context.modelDisagreement>.70){reason.push("high model disagreement");return{strategy:"ENSEMBLE",confidence:.45,ranked,reason};}
  if(best.sampleSize<20){reason.push("insufficient OOS sample");return{strategy:"CAUTIOUS",confidence:.30,ranked,reason};}
  reason.push(`best OOS strategy=${best.strategy}`);
  if(context.spatialDensity<.20&&best.strategy==="CONNECTED"){
    reason.push("spatial graph too sparse");
    return{strategy:"LOCAL",confidence:.45,ranked,reason};
  }
  const confidence=clamp(best._score,0,1);
  return{strategy:best.strategy,confidence,ranked,reason};
}
