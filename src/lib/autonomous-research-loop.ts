/**
 * Reality Investor — Autonomous Research Loop.
 *
 * Turns uncertainty into a research agenda. Instead of collecting everything,
 * it asks: "Which next observation or experiment has the highest expected
 * value for changing a decision?"
 */

export type ResearchKind =
  | "TRANSACTION_DATA"
  | "MICRO_LOCATION"
  | "BUILDING_FEATURE"
  | "FLOORPLAN"
  | "RENT"
  | "SUPPLY"
  | "CREDIT"
  | "MACRO"
  | "MODEL_EXPERIMENT"
  | "NEGOTIATION_OUTCOME";

export interface ResearchCandidate {
  id:string;
  kind:ResearchKind;
  description:string;
  expectedInformationGain:number;
  decisionImpact:number;
  freshness:number;
  reliability:number;
  cost:number;
  latency:number;
  currentGap:number;
}

export interface ResearchAction {
  id:string;
  kind:ResearchKind;
  priority:number;
  expectedUtility:number;
  reason:string;
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

export function rankResearchAgenda(
  candidates:ResearchCandidate[],
):ResearchAction[]{
  return candidates.map(x=>{
    const information=clamp(x.expectedInformationGain,0,1);
    const impact=clamp(x.decisionImpact,0,1);
    const quality=clamp(x.reliability,0,1)*clamp(x.freshness,0,1);
    const friction=1-clamp((x.cost+x.latency)/2,0,1);
    const gap=clamp(x.currentGap,0,1);
    const priority=
      0.30*information+
      0.30*impact+
      0.15*quality+
      0.15*friction+
      0.10*gap;

    return {
      id:x.id,
      kind:x.kind,
      priority,
      expectedUtility:priority,
      reason:
        impact>=.75
          ? "high probability of changing the investment decision"
          : information>=.75
            ? "large expected reduction in forecast uncertainty"
            : quality>=.75
              ? "high-quality missing evidence"
              : "incremental evidence may improve robustness"
    };
  }).sort((a,b)=>b.priority-a.priority);
}

/**
 * The loop should never "research forever". Stop when additional evidence is
 * unlikely to change the decision materially.
 */
export function shouldContinueResearch(
  topPriority:number,
  currentDecision:"BUY"|"NEGOTIATE"|"WAIT"|"WATCH"|"PASS",
){
  if(currentDecision==="PASS")return topPriority>=.75;
  return topPriority>=.45;
}
