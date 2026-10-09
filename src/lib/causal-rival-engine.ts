/**
 * Causal Rival Engine
 *
 * Forces competing explanations for an observed market move. A causal story
 * receives less trust when an alternative mechanism explains the same outcome
 * with comparable empirical support.
 */
export interface Explanation{
 id:string;mechanism:string;support:number;contradiction:number;timingFit:number;dataCoverage:number;
}
export interface RivalResult{
 winner:string|null;relativeAdvantage:number;ambiguity:number;
 explanations:Explanation[];confidenceCap:number;audit:string[];
}
const clamp=(x:number,a=0,b=1)=>Math.min(b,Math.max(a,x));
export function challengeCausalExplanation(xs:Explanation[]):RivalResult{
 const ranked=xs.map(x=>({...x,score:clamp(
   .40*x.support+.25*x.timingFit+.20*x.dataCoverage+.15*(1-x.contradiction)
 )})).sort((a,b)=>b.score-a.score);
 const top=ranked[0],second=ranked[1];
 const advantage=top?clamp(top.score-(second?.score??0)):0;
 const ambiguity=clamp(1-advantage);
 const cap=clamp(.35+.65*advantage);
 return{
  winner:top?.id??null,relativeAdvantage:advantage,ambiguity,
  explanations:ranked,confidenceCap:cap,
  audit:[
   "Competing mechanisms are scored before a causal explanation is trusted.",
   "Small separation between rivals is treated as causal ambiguity.",
   "Ambiguous mechanisms cap confidence rather than forcing a single story."
  ]
 };
}
