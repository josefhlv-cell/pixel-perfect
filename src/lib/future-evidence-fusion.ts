/**
 * Reality Investor — Future Evidence Fusion.
 *
 * Fuses pressure, ask/transaction divergence and expectation gaps into a
 * bounded evidence update for competing futures. Inputs remain evidence
 * strengths, not calibrated probabilities.
 */

import type {MarketPressureReport} from "./market-pressure-observatory";
import type {AskTransactionGapReport} from "./ask-transaction-gap";
import type {ExpectationGapReport} from "./expectation-gap";
import type {FutureHypothesisId} from "./future-state-lab";
import type {FutureEvidenceEvent} from "./future-trajectory";

export interface EvidenceFusionResult {
  events:FutureEvidenceEvent[];
  strongestSignal:string;
  confidence:number;
  structuralOnly:true;
}

export function fuseFutureEvidence(
  pressure:MarketPressureReport,
  askGap:AskTransactionGapReport,
  expectation:ExpectationGapReport,
  now:string,
):EvidenceFusionResult{
  const events:FutureEvidenceEvent[]=[];
  const add=(id:string,hypothesis:FutureHypothesisId,support:number,reliability:number,reason:string)=>{
    events.push({
      id,observedAt:now,availableAt:now,hypothesis,
      support:Math.max(-2,Math.min(2,support)),
      reliability,sourceQuality:Math.min(1,pressure.confidence),
      halfLifeMonths:3,reason,
    });
  };

  if(pressure.earlyWarning==="BROAD_DOWNSIDE_PRESSURE"){
    add("pressure-downside","DECELERATION",.8,pressure.confidence,"broad downside market pressure");
    add("pressure-correction","CORRECTION",.45,pressure.confidence,"broad downside pressure with liquidity/credit stress");
  }
  if(pressure.earlyWarning==="BROAD_UPSIDE_PRESSURE"){
    add("pressure-upside","ACCELERATION",.8,pressure.confidence,"broad upside market pressure");
  }
  if(askGap.widening){
    add("ask-realized-gap","DECELERATION",.65,askGap.latest?.reliability??.5,"asking prices are running ahead of realized conditions");
    add("ask-realized-correction","CORRECTION",.35,askGap.latest?.reliability??.5,"widening asking-to-realized gap increases negotiation pressure");
  }
  if(expectation.latest?.regime==="EXPECTATION_AHEAD"){
    add("expectation-ahead","DECELERATION",.55,expectation.latest.reliability,"market expectations are ahead of realized conditions");
    add("expectation-reversal","CORRECTION",.25,expectation.latest.reliability,"large expectation-reality gap creates reversal risk");
  }

  const strongest=events.reduce((best,e)=>Math.abs(e.support)>Math.abs(best?.support??0)?e:best,undefined as FutureEvidenceEvent|undefined);
  return {
    events,
    strongestSignal:strongest?.id??"none",
    confidence:Math.min(1,events.reduce((s,e)=>s+Math.abs(e.support)*e.reliability,0)/3),
    structuralOnly:true,
  };
}
