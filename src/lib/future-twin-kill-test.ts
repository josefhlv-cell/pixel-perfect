/**
 * Future Twin Kill Test
 *
 * Searches for historical counterexamples that invalidate a structural
 * digital-twin mechanism. A twin earns trust by surviving attempts to falsify
 * it, not by producing attractive scenarios.
 */
export interface TwinClaim{
 id:string;
 predictedDirection:"UP"|"DOWN"|"FLAT";
 predictedMagnitude:number;
 lower:number;
 upper:number;
}
export interface TwinOutcome{
 id:string;
 actualChange:number;
 regime:string;
 observedAt:string;
}
export interface TwinKillFinding{
 claimId:string;
 killed:boolean;
 error:number;
 outsideInterval:boolean;
 directionWrong:boolean;
 severity:number;
 reason:string;
}
export interface TwinKillReport{
 survivalRate:number;
 findings:TwinKillFinding[];
 fatalFailure:boolean;
 trustCap:number;
 audit:string[];
}
const clamp=(x:number,a=0,b=1)=>Math.min(b,Math.max(a,x));

export function runTwinKillTest(
 claims:TwinClaim[],
 outcomes:TwinOutcome[],
):TwinKillReport{
 const findings=claims.map(c=>{
  const o=outcomes.find(x=>x.id===c.id);
  if(!o)return{claimId:c.id,killed:false,error:0,outsideInterval:false,directionWrong:false,severity:1,reason:"No matured outcome"};
  const error=Math.abs(c.predictedMagnitude-o.actualChange);
  const directionWrong=(c.predictedDirection==="UP"&&o.actualChange<=0)||
    (c.predictedDirection==="DOWN"&&o.actualChange>=0)||
    (c.predictedDirection==="FLAT"&&Math.abs(o.actualChange)>Math.abs(c.predictedMagnitude)+1e-9);
  const outsideInterval=o.actualChange<c.lower||o.actualChange>c.upper;
  const severity=clamp(.5*(directionWrong?1:0)+.5*(outsideInterval?1:0));
  return{
   claimId:c.id,killed:severity>.5,error,outsideInterval,directionWrong,severity,
   reason:directionWrong?"direction failed":outsideInterval?"interval failed":"survived"
  };
 });
 const matured=findings.filter(x=>x.reason!=="No matured outcome");
 const killed=matured.filter(x=>x.killed).length;
 const survivalRate=matured.length?1-killed/matured.length:0;
 const fatalFailure=matured.length>=5&&survivalRate<.5;
 const trustCap=fatalFailure?.30:clamp(.30+.65*survivalRate);
 return{survivalRate,findings,fatalFailure,trustCap,audit:[
  "The twin is evaluated by counterexamples, not narrative plausibility.",
  "Direction and interval failures are tracked separately.",
  "Few or immature outcomes cannot certify the twin.",
  "A high kill rate caps trust and requires mechanism revision."
 ]};
}
