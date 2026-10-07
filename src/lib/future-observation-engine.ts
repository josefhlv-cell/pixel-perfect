/**
 * Future Observation Engine.
 *
 * Closes the loop between prediction and research:
 * when the model is uncertain, it chooses the next observation that can
 * discriminate between competing futures instead of merely collecting more data.
 */
import {rankResearchCandidates,type ResearchCandidate,type ResearchBrainResult} from "./global-research-brain";
import {nextBestObservation,type DataGap} from "./prediction-information-gain";

export interface FutureObservationCandidate extends ResearchCandidate {
  discriminates:string[];
  invalidates:string[];
}

export interface FutureObservationPlan {
  mode:ResearchBrainResult["researchMode"];
  topCandidate:string|null;
  nextObservation:string|null;
  priorities:ResearchBrainResult["priorities"];
  audit:string[];
}

export function buildFutureObservationPlan(
  candidates:FutureObservationCandidate[],
  gaps:DataGap[]=[],
):FutureObservationPlan{
  const research=rankResearchCandidates(candidates);
  const gap=nextBestObservation(gaps);
  const top=candidates.find(c=>c.id===research.topCandidate);
  const discriminator=top && top.discriminates.length
    ? " | distinguishes "+top.discriminates.join(", ")
    : "";

  return {
    mode:research.researchMode,
    topCandidate:research.topCandidate,
    nextObservation:top
      ? top.source+": "+top.reason+discriminator
      : gap?.action??null,
    priorities:research.priorities,
    audit:[
      ...research.audit,
      "The next observation is selected for decision relevance, not data volume.",
      "A candidate should be preferred when it can discriminate between competing futures.",
      "No external observation is treated as independent evidence unless source independence is established.",
    ],
  };
}
