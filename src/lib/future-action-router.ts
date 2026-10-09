/**
 * Future Action Router — converts Future OS evidence into one auditable
 * next action. It intentionally refuses false precision when evidence is weak.
 */
import {selectForecastStrategy,type StrategyEvidence} from "./adaptive-forecast-constitution";
import {measureFutureSignalVelocity,type VelocityObservation} from "./future-signal-velocity";
import {buildDecisionClock,type DecisionClockInput} from "./future-decision-clock";

export interface FutureActionRouterInput{
  strategies:StrategyEvidence[];
  strategyContext:{driftRisk:number;modelDisagreement:number;spatialDensity:number};
  signals:VelocityObservation[];
  clock:DecisionClockInput;
}
export interface FutureActionRouterOutput{
  strategy:ReturnType<typeof selectForecastStrategy>;
  velocity:ReturnType<typeof measureFutureSignalVelocity>;
  clock:ReturnType<typeof buildDecisionClock>;
  action:"ACT_NOW"|"NEGOTIATE"|"WAIT_FOR_SIGNAL"|"PASS";
  confidenceCap:number;
  audit:string[];
}
export function routeFutureAction(x:FutureActionRouterInput):FutureActionRouterOutput{
  const strategy=selectForecastStrategy(x.strategies,x.strategyContext);
  const velocity=measureFutureSignalVelocity(x.signals);
  const clock=buildDecisionClock(x.clock);
  let action:"ACT_NOW"|"NEGOTIATE"|"WAIT_FOR_SIGNAL"|"PASS"=clock.recommendation;
  if(action==="ACT_NOW"&&strategy.strategy==="CAUTIOUS")action="WAIT_FOR_SIGNAL";
  if(action==="ACT_NOW"&&velocity.evidenceShift==="EXTREME")action="NEGOTIATE";
  const confidenceCap=Math.min(
    strategy.confidence,
    x.strategyContext.driftRisk>.65?.35:1,
    x.strategyContext.modelDisagreement>.70?.55:1,
    velocity.evidenceShift==="EXTREME"?.65:1,
  );
  return{
    strategy,velocity,clock,action,
    confidenceCap:Math.max(0,Math.min(1,confidenceCap)),
    audit:[
      "Action is downstream of forecast strategy, signal velocity and timing.",
      "High drift or disagreement reduces allowable confidence.",
      "EXTREME signal velocity forces a more conservative action.",
    ],
  };
}
