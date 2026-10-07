/**
 * Future Signal Velocity — detects acceleration, breadth and cross-signal
 * agreement before a regime transition becomes obvious in prices.
 *
 * It is intentionally not a price predictor. It measures how quickly the
 * evidence landscape is changing and exposes the earliest actionable window.
 */
export type SignalDirection="UP"|"DOWN"|"MIXED";
export interface VelocityObservation{
  id:string;
  metric:string;
  value:number;
  previous:number;
  baseline:number;
  direction:SignalDirection;
  reliability:number;
  observedAt:string;
}
export interface SignalVelocity{
  id:string;
  acceleration:number;
  surprise:number;
  reliability:number;
  breadth:number;
  velocity:number;
  direction:SignalDirection;
}
export interface FutureSignalVelocityReport{
  signals:SignalVelocity[];
  composite:number;
  dominantDirection:SignalDirection;
  evidenceShift:"NONE"|"BUILDING"|"FAST"|"EXTREME";
  earliestSignal:string|null;
  warnings:string[];
}
const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));
export function measureFutureSignalVelocity(xs:VelocityObservation[]):FutureSignalVelocityReport{
  const signals=xs.map(x=>{
    const baseline=Math.abs(x.baseline)>1e-9?Math.abs(x.baseline):1;
    const acceleration=Math.abs(x.value-x.previous)/baseline;
    const surprise=Math.abs(x.value-x.baseline)/baseline;
    const reliability=clamp(x.reliability,0,1);
    const breadth=clamp(.5+.5*Math.sign((x.value-x.previous)*(x.value-x.baseline)),0,1);
    const velocity=clamp((.45*acceleration+.35*surprise+.20*breadth)*reliability,0,1);
    return {id:x.id,acceleration,surprise,reliability,breadth,velocity,direction:x.direction};
  });
  const total=signals.reduce((s,x)=>s+x.velocity,0);
  const composite=clamp(signals.length?total/Math.max(1,signals.length):0,0,1);
  const up=signals.filter(x=>x.direction==="UP").reduce((s,x)=>s+x.velocity,0);
  const down=signals.filter(x=>x.direction==="DOWN").reduce((s,x)=>s+x.velocity,0);
  const dominantDirection=Math.abs(up-down)<.05?"MIXED":up>down?"UP":"DOWN";
  const ordered=[...signals].sort((a,b)=>b.velocity-a.velocity);
  const evidenceShift=composite>=.75?"EXTREME":composite>=.50?"FAST":composite>=.25?"BUILDING":"NONE";
  const warnings:string[]=[];
  if(signals.length<3)warnings.push("low signal breadth");
  if(signals.filter(x=>x.reliability>=.7).length<2)warnings.push("limited high-reliability evidence");
  if(up>0&&down>0&&Math.min(up,down)/Math.max(up,down)>.55)warnings.push("cross-signal conflict");
  return {
    signals,composite,dominantDirection,evidenceShift,
    earliestSignal:ordered[0]?.id??null,warnings
  };
}
