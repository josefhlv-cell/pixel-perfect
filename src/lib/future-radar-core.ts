/**
 * Future Radar Core
 *
 * Decision-facing orchestration over signals, competing futures, market-twin
 * scenarios and uncertainty. It intentionally exposes disagreements instead
 * of collapsing them into one opaque score.
 */
import {competeFutureExplanations,type EvidenceClaim,type CompetingHypothesis} from "./future-evidence-competition";
import {rankFutureObservations,type ObservationCandidate} from "./future-observation-planner";
import {runFutureMarketTwin,type FutureMarketTwinInput} from "./future-market-twin";
import {evaluateFutureGeneralization,type GeneralizationCase} from "./future-generalization-gate";

export interface FutureRadarInput{
 claims:EvidenceClaim[];
 hypotheses:CompetingHypothesis[];
 observations:ObservationCandidate[];
 twin?:FutureMarketTwinInput;
 generalization?:GeneralizationCase[];
}
export interface FutureRadarOutput{
 state:"CLEAR"|"CONTESTED"|"DATA_STARVED";
 leadingFuture:string|null;
 runnerUp:string|null;
 separation:number;
 nextBestObservation:string|null;
 twinImpact:number|null;
 modelGeneralization:number|null;
 confidenceCap:number;
 watchlist:string[];
 audit:string[];
}
const clamp=(x:number,a=0,b=1)=>Math.min(b,Math.max(a,x));

export function buildFutureRadar(input:FutureRadarInput):FutureRadarOutput{
 const competition=competeFutureExplanations(input.claims,input.hypotheses);
 const scores=competition.scores;
 const top=scores[0],second=scores[1];
 const separation=top&&second?top.confidenceCap-second.confidenceCap:top?.confidenceCap??0;
 const observations=rankFutureObservations(input.observations,input.hypotheses.length);
 const twin=input.twin?runFutureMarketTwin(input.twin):null;
 const generalization=input.generalization?.length
   ?evaluateFutureGeneralization(input.generalization):null;
 const modelScore=generalization?.scores[0]?.robustness??null;
 const dataStarved=input.claims.length<3||!top;
 const state=dataStarved?"DATA_STARVED":competition.unresolved?"CONTESTED":"CLEAR";
 const confidenceCap=clamp(
   .45*(top?.confidenceCap??.2)+
   .20*(competition.unresolved?0.55:1)+
   .20*(modelScore??.55)+
   .15*(1-(twin?.uncertainty??.45))
 );
 const watchlist=[
  ...competition.scores.filter(x=>x.contradiction>.35).map(x=>`contradiction:${x.id}`),
  ...(competition.nextDiscriminator?[`missing:${competition.nextDiscriminator}`]:[]),
  ...(twin&&twin.uncertainty>.6?["high-scenario-uncertainty"]:[]),
  ...(generalization&&!generalization.champion?["no-generalization-champion"]:[]),
 ];
 return{
  state,leadingFuture:competition.winner,runnerUp:second?.id??null,separation,
  nextBestObservation:observations[0]?.id??null,
  twinImpact:twin?.scenarioImpact??null,modelGeneralization:modelScore,
  confidenceCap,watchlist,
  audit:[
   "Radar preserves disagreement instead of forcing a single narrative.",
   "Structural twin output is separated from empirical model evidence.",
   "Generalization evidence can cap confidence when future/spatial validation is weak.",
   "The next observation is chosen for expected uncertainty reduction.",
  ],
 };
}
