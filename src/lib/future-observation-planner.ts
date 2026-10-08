/**
 * Future Observation Planner
 *
 * Chooses the next observation that should reduce uncertainty between
 * competing futures. This is a practical value-of-information approximation,
 * not a claim of exact Bayesian information gain.
 */
export interface ObservationCandidate{
 id:string;
 family:string;
 cost:number;
 latencyDays:number;
 reliability:number;
 hypotheses:string[];
 expectedDiscrimination:number;
}
export interface ObservationPlan{
 id:string;
 family:string;
 expectedValue:number;
 timeToResultDays:number;
 reliability:number;
 reason:string;
}
export function rankFutureObservations(
 candidates:ObservationCandidate[],
 unresolvedHypotheses:number,
):ObservationPlan[]{
 return candidates.map(c=>{
  const discrimination=Math.min(1,c.expectedDiscrimination)*Math.min(1,unresolvedHypotheses/2);
  const friction=Math.min(1,c.cost/100)+Math.min(1,c.latencyDays/90);
  const value=Math.max(0,discrimination*c.reliability/(.35+friction));
  return {
   id:c.id,family:c.family,expectedValue:value,timeToResultDays:c.latencyDays,
   reliability:c.reliability,
   reason:value>.7?"High expected uncertainty reduction":
     value>.4?"Useful discriminator":"Low priority until better alternatives exist",
  };
 }).sort((a,b)=>b.expectedValue-a.expectedValue);
}
