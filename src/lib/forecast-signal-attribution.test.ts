import {describe,expect,it} from "vitest";
import {attributeTransitionPressure} from "./forecast-signal-attribution";
import type {MarketPressureReport} from "./market-pressure-observatory";

describe("forecast signal attribution",()=>{
  it("attributes downside transition pressure and preserves contradictions",()=>{
    const report:MarketPressureReport={
      composite:-.3,confidence:.7,bullishPressure:.2,bearishPressure:.8,conflict:.2,
      earlyWarning:"BROAD_DOWNSIDE_PRESSURE",nextObservation:"dom-impulse",
      signals:[
        {id:"dom-impulse",family:"LIQUIDITY",value:.2,direction:"BEARISH",leadMonths:2,reliability:.8,explanation:"DOM worsens"},
        {id:"credit-impulse",family:"CREDIT",value:.1,direction:"BULLISH",leadMonths:3,reliability:.8,explanation:"Credit improves"},
      ],
    };
    const r=attributeTransitionPressure(report,{
      from:"SOFT_LANDING",to:"CORRECTION",hazard:.4,
      trigger:"DOM and inventory worsen",invalidator:"liquidity improves",
    });
    expect(r.targetTransition).toBe("CORRECTION");
    expect(r.topSignals[0]?.signalId).toBe("dom-impulse");
    expect(r.contradictions[0]?.signalId).toBe("credit-impulse");
  });
});
