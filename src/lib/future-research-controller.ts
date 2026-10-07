/**
 * Future Research Controller — closes the loop between forecasting and
 * information acquisition.
 *
 * The model does not merely consume data. It identifies which missing fact
 * would most reduce uncertainty or change an investment decision, while
 * discounting correlated sources and blocking unsupported certainty.
 */
import {rankResearchCandidates,type ResearchCandidate,type ResearchBrainResult} from "./global-research-brain";
import {fuseEvidenceClaims,type EvidenceClaim,type FusedEvidence} from "./evidence-fusion-gate";
import {judgeForecastConstitution,type ConstitutionDecision} from "./forecast-constitution";
import {measureFutureSignalVelocity,type FutureSignalVelocityReport,type VelocityObservation} from "./future-signal-velocity";

export interface FutureResearchControllerInput{
  candidates:ResearchCandidate[];
  evidence:EvidenceClaim[];
  signalVelocity:VelocityObservation[];
  constitution:{
    pointInTimeValid:boolean;
    vintageValid:boolean;
    evidenceQuality:number;
    calibrationQuality:number;
    driftRisk:number;
    modelDisagreement:number;
    outcomeCount:number;
    minimumOutcomes:number;
  };
}

export interface FutureResearchControllerOutput{
  research:ResearchBrainResult;
  evidence:FusedEvidence[];
  velocity:FutureSignalVelocityReport;
  constitution:ConstitutionDecision;
  nextBestAction:string;
  confidenceCap:number;
  audit:string[];
}

export function runFutureResearchController(
  input:FutureResearchControllerInput,
):FutureResearchControllerOutput{
  const research=rankResearchCandidates(input.candidates);
  const evidence=fuseEvidenceClaims(input.evidence);
  const velocity=measureFutureSignalVelocity(input.signalVelocity);
  const constitution=judgeForecastConstitution(input.constitution);

  const conflict=evidence.filter(x=>x.dominantDirection==="CONFLICTED").length;
  const cap=Math.min(
    constitution.confidenceMultiplier,
    conflict>0?.70:1,
    velocity.evidenceShift==="EXTREME"?.80:1,
  );

  const nextBestAction=
    constitution.status==="BLOCK"
      ?constitution.requiredActions[0]??"repair forecast provenance"
      :velocity.evidenceShift==="EXTREME"
        ?"investigate the fastest-moving high-reliability signal"
        :research.topCandidate
          ?`acquire ${research.topCandidate} for maximum information value`
          :"wait for the next high-value observation";

  return {
    research,evidence,velocity,constitution,
    nextBestAction,confidenceCap:Math.max(0,Math.min(1,cap)),
    audit:[
      "The research loop optimizes information value, not data volume.",
      "Correlated sources are not counted as independent confirmation.",
      "Forecast confidence is capped by governance, evidence conflict and signal instability.",
      "Structural scenarios remain hypotheses until point-in-time outcomes calibrate them.",
    ],
  };
}
