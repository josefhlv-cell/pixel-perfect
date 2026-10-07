/**
 * Reality Investor — Global Research Brain.
 *
 * Chooses which external observation or dataset should be acquired next.
 * Acquisition value combines expected uncertainty reduction, decision impact,
 * model disagreement, source reliability, freshness, cost and latency.
 *
 * It is a research-prioritization engine, not an unrestricted web crawler.
 */

export type ResearchFamily=
  |"TRANSACTIONS"|"MICRO_LOCATION"|"BUILDING"
  |"RENT"|"SUPPLY"|"CREDIT"|"MACRO"|"INFRASTRUCTURE"
  |"SEARCH_BEHAVIOR"|"SENTIMENT"|"MODEL_EXPERIMENT";

export interface ResearchCandidate {
  id:string;
  family:ResearchFamily;
  source:string;
  expectedUncertaintyReduction:number;
  expectedDecisionImpact:number;
  modelDisagreementReduction:number;
  reliability:number;
  freshness:number;
  cost:number;
  latencyHours:number;
  coverage:number;
  reason:string;
}

export interface ResearchPriority {
  candidateId:string;
  priority:number;
  valuePerCost:number;
  expectedInformationGain:number;
  whyNow:string;
}

export interface ResearchBrainResult {
  priorities:ResearchPriority[];
  topCandidate:string|null;
  researchMode:"EXPLORE"|"TARGETED"|"HOLD";
  totalCandidates:number;
  audit:string[];
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

export function rankResearchCandidates(
  candidates:ResearchCandidate[],
):ResearchBrainResult{
  const priorities=candidates.map(c=>{
    const informationGain=clamp(
      .32*c.expectedUncertaintyReduction+
      .25*c.expectedDecisionImpact+
      .18*c.modelDisagreementReduction+
      .12*c.reliability+
      .08*c.freshness+
      .05*c.coverage,
      0,1
    );
    const costPenalty=1+
      Math.max(0,c.cost)*1.5+
      Math.max(0,c.latencyHours)/72;
    const valuePerCost=informationGain/costPenalty;
    return {
      candidateId:c.id,
      priority:valuePerCost,
      valuePerCost,
      expectedInformationGain:informationGain,
      whyNow:c.reason,
    };
  }).sort((a,b)=>b.priority-a.priority);

  const top=priorities[0];
  return {
    priorities,
    topCandidate:top?.candidateId??null,
    researchMode:!top
      ?"HOLD"
      :top.priority>.55
        ?"TARGETED"
        :"EXPLORE",
    totalCandidates:candidates.length,
    audit:[
      "Acquisition value is not the same as source importance.",
      "High uncertainty alone cannot justify acquisition.",
      "Freshness, reliability, coverage, cost and latency are part of research value.",
      "Research priorities must be re-evaluated after new evidence arrives.",
    ],
  };
}
