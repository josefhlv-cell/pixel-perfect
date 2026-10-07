/**
 * Future Decision Clock — converts a forecast into an actionable timeline.
 *
 * A forecast without timing is hard to trade. This layer identifies when a
 * signal should appear, when the thesis becomes invalid, and how costly delay
 * could be. All outputs are scenario/structural until calibrated by outcomes.
 */
export interface DecisionClockInput{
  currentDate:string;
  opportunityWindowDays:number;
  leadDays:number;
  invalidationDays:number;
  expectedUpside:number;
  expectedDownside:number;
  liquidity:number;
  confidence:number;
}
export interface DecisionClock{
  actBy:string;
  firstSignalBy:string;
  invalidAfter:string;
  urgency:number;
  waitCost:number;
  recommendation:"ACT_NOW"|"WATCH_CLOSELY"|"WAIT_FOR_SIGNAL"|"PASS";
  reason:string[];
}
const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));
function addDays(iso:string,days:number){return new Date(Date.parse(iso)+days*86400000).toISOString();}
export function buildDecisionClock(x:DecisionClockInput):DecisionClock{
  const urgency=clamp(
    .30*(1-x.confidence)+
    .25*Math.max(0,x.expectedDownside)+
    .20*Math.max(0,1-x.liquidity)+
    .25*Math.max(0,1-x.opportunityWindowDays/180),0,1
  );
  const waitCost=clamp(
    Math.max(0,x.expectedUpside)*Math.min(1,x.leadDays/90)*.55+
    Math.max(0,x.expectedDownside)*.45,0,1
  );
  const recommendation=
    x.confidence<.35||x.liquidity<.20?"PASS":
    urgency>.72?"ACT_NOW":
    x.leadDays>0&&x.opportunityWindowDays>x.leadDays?"WAIT_FOR_SIGNAL":
    "WATCH_CLOSELY";
  return{
    actBy:addDays(x.currentDate,Math.max(1,x.opportunityWindowDays)),
    firstSignalBy:addDays(x.currentDate,Math.max(1,x.leadDays)),
    invalidAfter:addDays(x.currentDate,Math.max(1,x.invalidationDays)),
    urgency,waitCost,recommendation,
    reason:[
      `leadDays=${x.leadDays}`,
      `opportunityWindowDays=${x.opportunityWindowDays}`,
      `waitCost=${waitCost.toFixed(2)}`,
    ],
  };
}
