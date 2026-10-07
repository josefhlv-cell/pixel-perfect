/**
 * Reality Investor — Forecast Signal Attribution.
 *
 * Ranks which observed leading signals most strongly support the currently
 * dominant future transition. This is structural attribution, not proof of
 * causal effect; causal coefficients must be learned and validated separately.
 */

import type {PressureSignal, MarketPressureReport} from "./market-pressure-observatory";
import type {TransitionEdge} from "./future-transition-hazard";

export interface SignalAttribution {
  signalId:string;
  family:PressureSignal["family"];
  contribution:number;
  leadMonths:number;
  direction:PressureSignal["direction"];
  supportsTransition:boolean;
  explanation:string;
}

export interface ForecastSignalAttribution {
  targetTransition:string;
  score:number;
  topSignals:SignalAttribution[];
  contradictions:SignalAttribution[];
  watchList:string[];
  status:"STRUCTURAL_ATTRIBUTION"|"INSUFFICIENT_SIGNAL";
}

export function attributeTransitionPressure(
  report:MarketPressureReport,
  edge:TransitionEdge|null,
):ForecastSignalAttribution{
  if(!edge){
    return {
      targetTransition:"NONE",
      score:0,
      topSignals:[],
      contradictions:[],
      watchList:[report.nextObservation],
      status:"INSUFFICIENT_SIGNAL",
    };
  }

  const downside=edge.to==="CORRECTION"||edge.to==="LIQUIDITY_CRISIS"||edge.to==="DECELERATION";
  const mapped=report.signals
    .filter(s=>s.direction!=="NEUTRAL")
    .map(s=>{
      const points=s.reliability*Math.abs(s.value)/(1+Math.max(0,s.leadMonths-1)*.12);
      const supports=downside?s.direction==="BEARISH":s.direction==="BULLISH";
      return {
        signalId:s.id,
        family:s.family,
        contribution:points,
        leadMonths:s.leadMonths,
        direction:s.direction,
        supportsTransition:supports,
        explanation:s.explanation,
      };
    })
    .sort((a,b)=>b.contribution-a.contribution);

  const supporting=mapped.filter(x=>x.supportsTransition);
  const contradictions=mapped.filter(x=>!x.supportsTransition);
  const total=supporting.reduce((s,x)=>s+x.contribution,0)+contradictions.reduce((s,x)=>s+x.contribution,0);
  const score=total?Math.min(1,supporting.reduce((s,x)=>s+x.contribution,0)/total):0;

  return {
    targetTransition:edge.to,
    score,
    topSignals:supporting.slice(0,5),
    contradictions:contradictions.slice(0,3),
    watchList:[
      edge.trigger,
      edge.invalidator,
      ...supporting.slice(0,3).map(x=>x.signalId),
    ],
    status:supporting.length?"STRUCTURAL_ATTRIBUTION":"INSUFFICIENT_SIGNAL",
  };
}
