/**
 * Future Drift Shield
 *
 * Converts regime-change evidence into a conservative trust budget.
 * It prevents historical patterns from retaining full authority after the
 * market's data-generating process appears to have changed.
 */
import {detectRegimeChange,type RegimeChangeInput,type RegimeChange} from "./regime-change-detector";

export interface DriftShieldInput extends RegimeChangeInput{
 baseConfidence:number;
 patternStability:number;
 forecastAgeDays:number;
}
export interface DriftShieldOutput{
 regime:RegimeChange;
 trustMultiplier:number;
 confidenceCap:number;
 retrainingUrgency:"NONE"|"SOON"|"URGENT";
 actions:string[];
}

const clamp=(x:number,a=0,b=1)=>Math.min(b,Math.max(a,x));

export function applyFutureDriftShield(x:DriftShieldInput):DriftShieldOutput{
 const regime=detectRegimeChange(x);
 const ageDecay=1-Math.min(.35,x.forecastAgeDays/365*.35);
 const severityPenalty=regime.severity==="BREAK"?.45:regime.severity==="SHIFT"?.70:
   regime.severity==="WATCH"?.88:1;
 const trustMultiplier=clamp(ageDecay*severityPenalty*(.65+.35*x.patternStability));
 const confidenceCap=clamp(Math.min(x.baseConfidence*trustMultiplier,
   regime.severity==="BREAK"?.40:regime.severity==="SHIFT"?.65:.90));
 const retrainingUrgency=regime.severity==="BREAK"?"URGENT":
   regime.severity==="SHIFT"?"SOON":"NONE";
 const actions:string[]=[];
 if(regime.adaptationRequired)actions.push("reweight recent observations");
 if(regime.severity==="BREAK")actions.push("disable stale champion until replay");
 if(regime.severity==="SHIFT")actions.push("run contextual model tournament");
 if(regime.severity==="WATCH")actions.push("increase monitoring frequency");
 return{regime,trustMultiplier,confidenceCap,retrainingUrgency,actions};
}
