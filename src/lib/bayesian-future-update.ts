/**
 * Reality Investor — Bayesian Future Update.
 *
 * Converts new point-in-time evidence into relative support changes for
 * competing future hypotheses. Likelihoods are evidence factors, not claimed
 * probabilities, until calibrated on historical outcomes.
 */

import type {FutureHypothesisId} from "./future-state-lab";

export interface FutureEvidenceFactor {
  hypothesis:FutureHypothesisId;
  likelihoodRatio:number;
  reliability:number;
  sourceQuality:number;
  reason:string;
}

export interface FuturePosterior {
  hypothesis:FutureHypothesisId;
  prior:number;
  support:number;
  posterior:number;
  shift:number;
  evidenceCount:number;
}

export interface BayesianFutureUpdate {
  posteriors:FuturePosterior[];
  dominant:FutureHypothesisId|null;
  entropy:number;
  materialChange:boolean;
  trigger:string|null;
  calibrationStatus:"RELATIVE_SUPPORT_UNCALIBRATED"|"EMPIRICALLY_CALIBRATED";
  audit:string[];
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

function entropy(ps:number[]):number{
  const p=ps.filter(x=>x>0);
  if(p.length<2)return 0;
  return clamp(-p.reduce((s,x)=>s+x*Math.log(x),0)/Math.log(p.length),0,1);
}

export function updateFuturePosterior(
  priors:Partial<Record<FutureHypothesisId,number>>,
  factors:FutureEvidenceFactor[],
):BayesianFutureUpdate{
  const ids=[...new Set([
    ...Object.keys(priors),
    ...factors.map(f=>f.hypothesis),
  ])] as FutureHypothesisId[];

  const raw=ids.map(h=>{
    const prior=Math.max(1e-6,priors[h]??1/Math.max(1,ids.length));
    const relevant=factors.filter(f=>f.hypothesis===h);
    const logSupport=relevant.reduce((s,f)=>{
      const lr=clamp(f.likelihoodRatio,.05,20);
      const weight=clamp(f.reliability*f.sourceQuality,0,1);
      return s+Math.log(lr)*weight;
    },0);
    return {h,prior,support:prior*Math.exp(logSupport),evidenceCount:relevant.length};
  });

  const total=raw.reduce((s,x)=>s+x.support,0)||1;
  const posteriors=raw.map(x=>({
    hypothesis:x.h,
    prior:x.prior,
    support:x.support,
    posterior:x.support/total,
    shift:x.support/total-x.prior,
    evidenceCount:x.evidenceCount,
  })).sort((a,b)=>b.posterior-a.posterior);

  const dominant=posteriors[0]?.hypothesis??null;
  const ent=entropy(posteriors.map(x=>x.posterior));
  const materialChange=posteriors.some(x=>Math.abs(x.shift)>=.10);

  return {
    posteriors,
    dominant,
    entropy:ent,
    materialChange,
    trigger:materialChange
      ? "Evidence materially changed support for "+(dominant??"a future hypothesis")+"."
      : null,
    calibrationStatus:"RELATIVE_SUPPORT_UNCALIBRATED",
    audit:[
      "Evidence updates are relative support factors until likelihood ratios are calibrated on historical outcomes.",
      "Reliability and source quality shrink the effect of weak evidence.",
      "Copied evidence should be fused before reaching this updater.",
    ],
  };
}
