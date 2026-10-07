/**
 * Reality Investor — Bayesian Likelihood Calibration.
 *
 * Learns evidence likelihood ratios from point-in-time historical outcomes.
 * Small samples are shrunk toward neutrality so they cannot manufacture
 * extreme evidence.
 */

export interface CalibrationCase {
  signal:string;
  hypothesis:string;
  regime:string;
  evidencePresent:boolean;
  outcomeSupported:boolean;
  weight:number;
}

export interface LikelihoodCalibration {
  signal:string;
  hypothesis:string;
  regime:string;
  cases:number;
  supportRate:number;
  baseRate:number;
  likelihoodRatio:number;
  logLikelihoodRatio:number;
  confidence:number;
  status:"EMPIRICALLY_CALIBRATED"|"SHRUNK_SMALL_SAMPLE"|"INSUFFICIENT_DATA";
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

export function calibrateLikelihoodRatios(
  cases:CalibrationCase[],
  minCases=30,
):LikelihoodCalibration[]{
  const keys=[...new Set(cases.map(c=>c.signal+"|"+c.hypothesis+"|"+c.regime))];

  return keys.map(key=>{
    const parts=key.split("|");
    const signal=parts[0]??"";
    const hypothesis=parts[1]??"";
    const regime=parts[2]??"";
    const group=cases.filter(c=>c.signal===signal&&c.hypothesis===hypothesis&&c.regime===regime);

    const weightOf=(c:CalibrationCase)=>Math.max(.01,c.weight);
    const totalWeight=group.reduce((s,c)=>s+weightOf(c),0);
    const supportedWeight=group.filter(c=>c.outcomeSupported)
      .reduce((s,c)=>s+weightOf(c),0);

    const allEvidence=cases.filter(c=>c.signal===signal&&c.regime===regime);
    const baseWeight=allEvidence.reduce((s,c)=>s+weightOf(c),0);
    const baseSupported=allEvidence.filter(c=>c.outcomeSupported)
      .reduce((s,c)=>s+weightOf(c),0);

    const alpha=.5;
    const supportRate=(supportedWeight+alpha)/(totalWeight+1);
    const baseRate=(baseSupported+alpha)/(baseWeight+1);
    const rawLR=supportRate/Math.max(.01,baseRate);

    const sampleFactor=clamp(totalWeight/minCases,0,1);
    const shrink=.25+.75*sampleFactor;
    const logLR=Math.log(rawLR)*shrink;
    const lr=Math.exp(logLR);

    return {
      signal,hypothesis,regime,cases:group.length,
      supportRate,baseRate,
      likelihoodRatio:clamp(lr,.2,5),
      logLikelihoodRatio:logLR,
      confidence:clamp(.2+.8*sampleFactor,0,1),
      status:group.length<10
        ?"INSUFFICIENT_DATA"
        :group.length<minCases
          ?"SHRUNK_SMALL_SAMPLE"
          :"EMPIRICALLY_CALIBRATED",
    };
  });
}
