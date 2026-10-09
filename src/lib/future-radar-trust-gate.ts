/**
 * Future Radar Trust Gate
 *
 * Final confidence ceiling before a future signal reaches decision UI.
 * It combines empirical competition, drift, novelty and twin falsification.
 */
export interface TrustGateInput{
 evidenceConfidence:number;
 driftSeverity:"NONE"|"WATCH"|"SHIFT"|"BREAK";
 noveltyStatus:"KNOWN"|"NOVEL"|"UNKNOWN_REGIME";
 twinSurvival:number;
 generalization:number;
}
export interface TrustGateOutput{
 confidenceCap:number;
 status:"TRUSTED"|"CAUTIOUS"|"RESEARCH_ONLY"|"BLOCKED";
 reasons:string[];
}
const clamp=(x:number,a=0,b=1)=>Math.min(b,Math.max(a,x));
export function applyFutureRadarTrustGate(x:TrustGateInput):TrustGateOutput{
 let cap=clamp(x.evidenceConfidence);
 const reasons:string[]=[];
 const driftCap={NONE:1,WATCH:.88,SHIFT:.65,BREAK:.35}[x.driftSeverity];
 const noveltyCap={KNOWN:1,NOVEL:.65,UNKNOWN_REGIME:.35}[x.noveltyStatus];
 cap=Math.min(cap,driftCap,noveltyCap,clamp(x.twinSurvival),clamp(x.generalization));
 if(x.driftSeverity!=="NONE")reasons.push(`drift=${x.driftSeverity}`);
 if(x.noveltyStatus!=="KNOWN")reasons.push(`novelty=${x.noveltyStatus}`);
 if(x.twinSurvival<.60)reasons.push("digital twin has weak historical survival");
 if(x.generalization<.50)reasons.push("weak future/spatial generalization");
 const status=cap>=.75?"TRUSTED":cap>=.50?"CAUTIOUS":cap>=.30?"RESEARCH_ONLY":"BLOCKED";
 return{confidenceCap:cap,status,reasons};
}
