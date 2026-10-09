/**
 * Future Radar — one compact state vector for the UI/AI layer.
 */
import {adversarialFutureLab, type ForecastAnchor} from "./adversarial-future-lab";
import {buildFutureScenarioStack} from "./future-scenario-stack";
import {evaluateTriggers,type TriggerObservation,defaultFutureTriggers} from "./future-trigger-engine";
export interface FutureRadarInput extends ForecastAnchor{rentGrowth:number;inventory:number;rateChange:number;creditGrowth:number;domChange:number;}
export interface FutureRadarOutput{state:"GREEN"|"AMBER"|"RED"|"UNKNOWN";score:number;dominantScenario:string;attackRisk:number;triggeredSignals:string[];leadOpportunity:number;why:string[];}
export function buildFutureRadar(x:FutureRadarInput,observations:TriggerObservation[]=[]):FutureRadarOutput{
 const attacks=adversarialFutureLab({priceGrowth:x.priceGrowth,rentGrowth:x.rentGrowth,liquidity:x.liquidity,confidence:x.confidence,modelRisk:x.modelRisk});
 const scenarios=buildFutureScenarioStack({growth:x.priceGrowth,rentGrowth:x.rentGrowth,liquidity:x.liquidity,inventory:x.inventory,rateChange:x.rateChange,confidence:x.confidence});
 const triggers=evaluateTriggers(defaultFutureTriggers(),observations);
 const fired=triggers.filter(t=>t.fired);
 const attackRisk=1-attacks.survivalRate;
 const score=Math.max(0,Math.min(100,100*(.35*x.confidence+.25*(1-x.modelRisk)+.20*(1-attackRisk)+.20*(1-fired.length/5))));
 const state=score>=70?"GREEN":score>=45?"AMBER":"RED";
 return {state,score,dominantScenario:scenarios[0]!.path,attackRisk,triggeredSignals:fired.map(x=>x.triggerId),leadOpportunity:fired.length?Math.max(...fired.map(x=>x.leadDays)):0,
  why:[`confidence=${x.confidence.toFixed(2)}`,`modelRisk=${x.modelRisk.toFixed(2)}`,`attackRisk=${attackRisk.toFixed(2)}`,fired.length?`${fired.length} early-warning triggers fired`:"no early-warning trigger fired"]};
}
