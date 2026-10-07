/**
 * Adversarial Future Lab.
 * Attacks a forecast by constructing the strongest plausible mechanisms that
 * would make the forecast wrong. Structural until calibrated on point-in-time outcomes.
 */
export type AttackKind="RATE_SHOCK"|"CREDIT_FREEZE"|"DEMAND_BREAK"|"SUPPLY_SURGE"|"LIQUIDITY_TRAP"|"DATA_FAILURE"|"REGIME_BREAK";
export interface ForecastAnchor{priceGrowth:number;rentGrowth:number;liquidity:number;confidence:number;modelRisk:number;}
export interface AttackScenario{id:string;kind:AttackKind;severity:number;probability:number;mechanism:string[];signals:string[];invalidators:string[];priceGrowth:number;liquidity:number;survives:boolean;}
export interface AdversarialFutureResult{base:ForecastAnchor;attacks:AttackScenario[];survivalRate:number;worstCaseGrowth:number;mostDangerous:string;fragility:string[];nextTests:string[];}
const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));
export function adversarialFutureLab(base:ForecastAnchor):AdversarialFutureResult{
 const defs:Array<[AttackKind,number,string[],string[],string[]]>=
 [
  ["RATE_SHOCK",.82,["financing cost jumps","refinancing capacity falls"],["mortgage rates","approvals","refinancing spreads"],["rapid rate cuts","stable credit"]],
  ["CREDIT_FREEZE",.9,["banks tighten underwriting","transaction chain breaks"],["mortgage approvals","LTV","failed transactions"],["credit growth recovery"]],
  ["DEMAND_BREAK",.78,["employment weakens","buyer urgency collapses"],["search-to-viewing","DOM","withdrawals"],["transaction recovery"]],
  ["SUPPLY_SURGE",.72,["inventory accumulates","price competition increases"],["new listings","inventory months","price cuts"],["inventory absorption"]],
  ["LIQUIDITY_TRAP",.86,["headline value remains stable","realizable sale price deteriorates"],["DOM","withdrawals","bid-ask gap"],["transaction volume recovery"]],
  ["DATA_FAILURE",.95,["coverage changes","source latency/revisions increase"],["missingness","vintage drift","source disagreement"],["independent transaction confirmation"]],
  ["REGIME_BREAK",1.0,["historical relationships stop holding","residuals shift"],["forecast error","model disagreement","feature drift"],["stable OOS residuals"]],
 ];
 const attacks=defs.map(([kind,sev,mechanism,signals,invalidators],i)=>{
  const growthDelta=kind==="RATE_SHOCK"?-.045:kind==="CREDIT_FREEZE"?-.065:kind==="DEMAND_BREAK"?-.055:kind==="SUPPLY_SURGE"?-.035:kind==="LIQUIDITY_TRAP"?-.025:kind==="DATA_FAILURE"?-.015:-(.06+base.modelRisk*.04);
  const p=clamp((.08+i*.025)*(1+base.modelRisk),.03,.35);
  return {id:`ATTACK_${i+1}`,kind,severity:sev,probability:p,mechanism,signals,invalidators,
    priceGrowth:base.priceGrowth+growthDelta,liquidity:clamp(base.liquidity-(kind==="LIQUIDITY_TRAP"?.25:.12)*sev,0,1),
    survives:base.confidence>.45&&base.modelRisk<.55&&kind!=="DATA_FAILURE"};
 });
 const dangerous=[...attacks].sort((a,b)=>(a.priceGrowth+a.liquidity*.03)-(b.priceGrowth+b.liquidity*.03))[0]!;
 const survivalRate=attacks.filter(x=>x.survives).length/attacks.length;
 return {base,attacks,survivalRate,worstCaseGrowth:Math.min(...attacks.map(x=>x.priceGrowth)),mostDangerous:dangerous.id,
   fragility:attacks.filter(x=>!x.survives).map(x=>x.kind),
   nextTests:[dangerous.signals[0]!,dangerous.signals[1]!,...base.modelRisk>.45?["nový OOS replay v aktuálním režimu"]:[]]};
}
