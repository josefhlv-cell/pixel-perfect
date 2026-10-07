/**
 * Future Decision Counterfactuals — action-boundary analysis.
 * Existing counterfactual simulation remains untouched; this layer answers
 * which observable change would flip the investor's current decision.
 */
export type ActionDecision="BUY"|"NEGOTIATE"|"WAIT"|"PASS";
export interface DecisionBoundaryInput{score:number;downsideProbability:number;liquidity:number;}
export interface DecisionFlip{variable:"score"|"downsideProbability"|"liquidity";current:number;threshold:number;delta:number;decision:ActionDecision;reason:string;}
export interface DecisionBoundaryReport{current:ActionDecision;upgrade:DecisionFlip|null;downgrade:DecisionFlip|null;fragility:"LOW"|"MEDIUM"|"HIGH";}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));
function decide(x:DecisionBoundaryInput):ActionDecision{
 if(x.score>=80&&x.downsideProbability<.35&&x.liquidity>.60)return "BUY";
 if(x.score>=65&&x.downsideProbability<.55&&x.liquidity>.25)return "NEGOTIATE";
 if(x.score<45||x.liquidity<.15)return "PASS";
 return "WAIT";
}
export function findDecisionBoundaries(x:DecisionBoundaryInput):DecisionBoundaryReport{
 const current=decide(x), flips:DecisionFlip[]=[];
 const candidates:[DecisionFlip["variable"],number,string][]=[
  ["score",current==="PASS"?45:current==="WAIT"?65:80,"forecast quality crosses the next action boundary"],
  ["downsideProbability",current==="BUY"?.35:current==="NEGOTIATE"?.55:.70,"downside reaches the next risk boundary"],
  ["liquidity",current==="BUY"?.60:current==="NEGOTIATE"?.25:.15,"exit liquidity reaches the next safety boundary"],
 ];
 for(const [variable,threshold,reason] of candidates){
  const next=decide({...x,[variable]:threshold});
  if(next!==current)flips.push({variable,current:x[variable],threshold,delta:threshold-x[variable],decision:next,reason});
 }
 const up=flips.find(f=>f.decision==="BUY"||f.decision==="NEGOTIATE")??null;
 const down=flips.find(f=>f.decision==="PASS"||f.decision==="WAIT")??null;
 const margin=down?Math.abs(down.delta):1;
 return{current,upgrade:up,downgrade:down,fragility:margin<.10?"HIGH":margin<.25?"MEDIUM":"LOW"};
}
