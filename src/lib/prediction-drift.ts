/**
 * Reality Investor — distribution/regime drift detector.
 *
 * A model should lose confidence when today's feature distribution no longer
 * resembles the period in which it learned its relationships.
 */

export interface DriftFeature{
  name:string;
  referenceMean:number;
  referenceStd:number;
  currentMean:number;
  currentStd:number;
  importance:number;
}

export interface DriftReport{
  score:number;
  severity:"LOW"|"MODERATE"|"HIGH"|"CRITICAL";
  features:{name:string;z:number;contribution:number}[];
  recommendation:"NORMAL"|"DOWNWEIGHT"|"RECALIBRATE"|"RETRAIN";
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

export function detectFeatureDrift(features:DriftFeature[]):DriftReport{
  const out=features.map(f=>{
    const z=Math.abs(f.currentMean-f.referenceMean)/Math.max(f.referenceStd,1);
    const varianceShift=Math.abs(Math.log(Math.max(f.currentStd,1)/Math.max(f.referenceStd,1)));
    const contribution=clamp((z+varianceShift)*f.importance,0,10);
    return {name:f.name,z,contribution};
  });
  const total=out.reduce((s,x)=>s+x.contribution,0)/Math.max(1,features.reduce((s,x)=>s+x.importance,0));
  const score=clamp(total/3,0,1);
  const severity=score>=.8?"CRITICAL":score>=.55?"HIGH":score>=.3?"MODERATE":"LOW";
  return {
    score,
    severity,
    features:out.sort((a,b)=>b.contribution-a.contribution),
    recommendation:severity==="CRITICAL"?"RETRAIN":severity==="HIGH"?"RECALIBRATE":severity==="MODERATE"?"DOWNWEIGHT":"NORMAL"
  };
}

export function confidenceAfterDrift(confidence:number,driftScore:number){
  return clamp(confidence*(1-0.75*clamp(driftScore,0,1)),0.02,0.98);
}
