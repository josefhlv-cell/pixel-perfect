/**
 * Reality Investor — Market Regime Change Detector.
 *
 * Detects changes in the data-generating process using several independent
 * signals rather than one arbitrary threshold. It is intentionally a detector,
 * not a causal claim: a detected change means "relationships may have changed".
 */

export type ChangeSeverity="NONE"|"WATCH"|"SHIFT"|"BREAK";

export interface RegimeChangeInput {
  currentMean:number;
  baselineMean:number;
  currentVolatility:number;
  baselineVolatility:number;
  currentSlope:number;
  baselineSlope:number;
  modelErrorCurrent:number;
  modelErrorBaseline:number;
  modelDisagreement:number;
  liquidityChange:number;
  sampleSize:number;
}

export interface RegimeChange {
  severity:ChangeSeverity;
  score:number;
  signals:string[];
  adaptationRequired:boolean;
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));
const ratio=(a:number,b:number)=>Math.abs(b)>1e-9?Math.abs(a/b-1):1;

export function detectRegimeChange(x:RegimeChangeInput):RegimeChange{
  const signals:string[]=[];
  let score=0;

  const meanShift=ratio(x.currentMean,x.baselineMean);
  const volShift=ratio(x.currentVolatility,x.baselineVolatility);
  const slopeShift=Math.abs(x.currentSlope-x.baselineSlope);
  const errorShift=ratio(x.modelErrorCurrent,x.modelErrorBaseline);

  if(meanShift>.10){score+=.18;signals.push("level shift");}
  if(volShift>.25){score+=.16;signals.push("volatility shift");}
  if(slopeShift>0.005){score+=.18;signals.push("trend slope shift");}
  if(errorShift>.25){score+=.20;signals.push("forecast error deterioration");}
  if(x.modelDisagreement>.45){score+=.12;signals.push("model disagreement spike");}
  if(Math.abs(x.liquidityChange)>.20){score+=.10;signals.push("liquidity shift");}

  if(x.sampleSize<20)score+=.06;
  score=clamp(score,0,1);

  const severity:ChangeSeverity=
    score>=.72?"BREAK":
    score>=.48?"SHIFT":
    score>=.25?"WATCH":"NONE";

  return {
    severity,
    score,
    signals,
    adaptationRequired:severity==="SHIFT"||severity==="BREAK"
  };
}
