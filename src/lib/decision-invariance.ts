/**
 * Reality Investor — Decision Invariance.
 *
 * Finds actions that remain acceptable across many plausible futures.
 * A deal is stronger when its recommendation is not dependent on one narrow
 * forecast path. This is a robustness measure, not a guarantee.
 */

export type RobustAction="BUY_NOW"|"NEGOTIATE"|"WAIT"|"PASS";

export interface ScenarioDecision {
  scenarioId:string;
  action:RobustAction;
  utility:number;
  survival:boolean;
}

export interface DecisionInvariance {
  dominantAction:RobustAction;
  agreement:number;
  survivalRate:number;
  worstUtility:number;
  bestUtility:number;
  regret:number;
  label:"ROBUST"|"FRAGILE"|"UNSTABLE";
}

export function decisionInvariance(rows:ScenarioDecision[]):DecisionInvariance{
  if(!rows.length)return {
    dominantAction:"PASS",agreement:0,survivalRate:0,
    worstUtility:0,bestUtility:0,regret:0,label:"UNSTABLE"
  };

  const counts=new Map<RobustAction,number>();
  for(const r of rows)counts.set(r.action,(counts.get(r.action)||0)+1);
  const dominant=[...counts.entries()].sort((a,b)=>b[1]-a[1])[0][0];
  const agreement=(counts.get(dominant)||0)/rows.length;
  const survivalRate=rows.filter(r=>r.survival).length/rows.length;
  const utilities=rows.map(r=>r.utility);
  const best=Math.max(...utilities),worst=Math.min(...utilities);
  const dominantUtilities=rows.filter(r=>r.action===dominant).map(r=>r.utility);
  const regret=Math.max(0,best-Math.min(...dominantUtilities));

  const label=agreement>=.80&&survivalRate>=.80?"ROBUST":
    agreement>=.60&&survivalRate>=.65?"FRAGILE":"UNSTABLE";

  return {
    dominantAction:dominant,agreement,survivalRate,
    worstUtility:worst,bestUtility:best,regret,label
  };
}
