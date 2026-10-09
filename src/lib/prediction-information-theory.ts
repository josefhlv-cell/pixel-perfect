/**
 * Reality Investor — information-theoretic observation priority.
 *
 * The best next data point is not the most interesting one; it is the one
 * expected to reduce forecast entropy or model disagreement the most.
 */

export interface CandidateObservation{
  name:string;
  acquisitionCost:number;
  expectedEntropyReduction:number;
  expectedModelDisagreementReduction:number;
  decisionImpact:number;
  freshness:number;
}

export function rankInformationActions(rows:CandidateObservation[]){
  return [...rows].map(x=>{
    const value=(0.40*x.expectedEntropyReduction+
      0.30*x.expectedModelDisagreementReduction+
      0.30*x.decisionImpact)*Math.max(0.1,Math.min(1,x.freshness));
    return {...x,informationValue:value/Math.max(0.01,x.acquisitionCost)};
  }).sort((a,b)=>b.informationValue-a.informationValue);
}
