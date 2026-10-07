/**
 * Future Trigger Engine — converts hypotheses into measurable state transitions.
 */
export type TriggerDirection="UP"|"DOWN"|"BREAKOUT"|"PERSISTENCE";
export interface Trigger{ id:string;metric:string;direction:TriggerDirection;threshold:number;windowDays:number;leadDays:number;weight:number;reason:string; }
export interface TriggerObservation{metric:string;value:number;previous?:number;observedAt:string;}
export interface TriggerState{triggerId:string;fired:boolean;strength:number;leadDays:number;reason:string;}
const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));
export function evaluateTriggers(triggers:Trigger[],obs:TriggerObservation[]):TriggerState[]{
 return triggers.map(t=>{
  const o=obs.find(x=>x.metric===t.metric);
  if(!o)return {triggerId:t.id,fired:false,strength:0,leadDays:t.leadDays,reason:"missing observation"};
  const delta=o.previous===undefined?0:o.value-o.previous;
  const raw=t.direction==="UP"?o.value-t.threshold:t.direction==="DOWN"?t.threshold-o.value:
   t.direction==="BREAKOUT"?Math.abs(delta)-t.threshold:Math.abs(delta);
  const strength=clamp(raw/(Math.abs(t.threshold)||1),0,1);
  return {triggerId:t.id,fired:strength>=.5,strength,leadDays:t.leadDays,reason:t.reason};
 });
}
export function defaultFutureTriggers():Trigger[]{
 return [
  {id:"DOM_BREAK",metric:"domChange",direction:"UP",threshold:.10,windowDays:30,leadDays:60,weight:1,reason:"Likely demand deterioration"},
  {id:"INVENTORY_BREAK",metric:"inventoryGrowth",direction:"UP",threshold:.08,windowDays:30,leadDays:75,weight:1,reason:"Supply pressure rising"},
  {id:"RATE_BREAK",metric:"mortgageRateChange",direction:"UP",threshold:.01,windowDays:14,leadDays:45,weight:1.1,reason:"Financing shock"},
  {id:"CREDIT_BREAK",metric:"creditGrowth",direction:"DOWN",threshold:.03,windowDays:30,leadDays:90,weight:1.2,reason:"Credit transmission weakening"},
  {id:"LIQUIDITY_BREAK",metric:"liquidity",direction:"DOWN",threshold:.15,windowDays:30,leadDays:60,weight:1.3,reason:"Exit risk rising"},
 ];
}
