/**
 * Future Decision Robustness — tests whether the same action survives competing futures.
 */
export type Action="BUY"|"NEGOTIATE"|"WAIT"|"PASS";
export interface DecisionScenario{scenario:string;probability:number;utility:Record<Action,number>;}
export interface RobustnessResult{recommended:Action;agreement:number;expectedUtility:number;minUtility:number;regret:number;fragility:number;}
export function evaluateDecisionRobustness(rows:DecisionScenario[]):RobustnessResult{
 if(!rows.length)return {recommended:"PASS",agreement:0,expectedUtility:0,minUtility:0,regret:0,fragility:1};
 const actions:Array<Action>=["BUY","NEGOTIATE","WAIT","PASS"];
 const eu=Object.fromEntries(actions.map(a=>[a,rows.reduce((s,r)=>s+r.probability*r.utility[a],0)])) as Record<Action,number>;
 const recommended=actions.reduce((a,b)=>eu[b]>eu[a]?b:a);
 const winners=rows.filter(r=>actions.reduce((a,b)=>r.utility[b]>r.utility[a]?b:a)===recommended).length;
 const regret=rows.reduce((s,r)=>s+r.probability*(Math.max(...actions.map(a=>r.utility[a]))-r.utility[recommended]),0);
 const minUtility=Math.min(...rows.map(r=>r.utility[recommended]));
 return {recommended,agreement:winners/rows.length,expectedUtility:eu[recommended],minUtility,regret,fragility:1-winners/rows.length};
}
