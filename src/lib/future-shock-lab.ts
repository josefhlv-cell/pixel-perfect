/**
 * Future Shock Lab — controlled counterfactual stress testing.
 * It deliberately separates plausible scenarios from historical forecast.
 */

export type ShockKind="RATE"|"CREDIT"|"SUPPLY"|"DEMAND"|"EMPLOYMENT"|"CONSTRUCTION";

export interface Shock{
  kind:ShockKind;
  magnitudeBps:number;
  durationMonths:number;
  probability?:number;
}

export interface ShockOutcome{
  shock:Shock;
  growthDeltaBps:number;
  priceDeltaPct:number;
  liquidityDeltaBps:number;
  severity:"MILD"|"MODERATE"|"SEVERE"|"EXTREME";
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

export function simulateShock(baseAnnualGrowthBps:number,baseLiquidityBps:number,shock:Shock):ShockOutcome{
  const duration=Math.min(1.5,Math.max(0.1,shock.durationMonths/12));
  const sensitivities:Record<ShockKind,number>={
    RATE:-0.75,CREDIT:-0.55,SUPPLY:-0.65,DEMAND:0.70,EMPLOYMENT:-0.60,CONSTRUCTION:-0.35
  };
  const growthDelta=shock.magnitudeBps*sensitivities[shock.kind]*duration;
  const liquidityDelta=shock.magnitudeBps*(shock.kind==="DEMAND"||shock.kind==="CREDIT"?0.45:-0.18)*duration;
  const priceDeltaPct=(Math.exp((baseAnnualGrowthBps+growthDelta)/10000)-Math.exp(baseAnnualGrowthBps/10000))*100;
  const severityAbs=Math.abs(growthDelta);
  return {
    shock,
    growthDeltaBps:Math.round(growthDelta),
    priceDeltaPct,
    liquidityDeltaBps:Math.round(liquidityDelta),
    severity:severityAbs>3500?"EXTREME":severityAbs>2000?"SEVERE":severityAbs>900?"MODERATE":"MILD"
  };
}

export function shockMatrix(baseGrowthBps:number,liquidityBps:number):ShockOutcome[]{
  const shocks:Shock[]=[
    {kind:"RATE",magnitudeBps:1000,durationMonths:12},
    {kind:"RATE",magnitudeBps:-1000,durationMonths:12},
    {kind:"CREDIT",magnitudeBps:-1500,durationMonths:12},
    {kind:"SUPPLY",magnitudeBps:2500,durationMonths:24},
    {kind:"DEMAND",magnitudeBps:1800,durationMonths:12},
    {kind:"EMPLOYMENT",magnitudeBps:-1200,durationMonths:18},
    {kind:"CONSTRUCTION",magnitudeBps:3000,durationMonths:24}
  ];
  return shocks.map(s=>simulateShock(baseGrowthBps,liquidityBps,s));
}
