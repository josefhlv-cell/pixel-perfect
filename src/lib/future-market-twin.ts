/**
 * Future Market Twin
 *
 * Structural counterfactual simulator for market-state propagation.
 * It is a scenario laboratory, not an empirical forecast by itself.
 *
 * A shock changes one or more state variables; the causal graph propagates
 * those changes through lagged mechanisms. The result exposes uncertainty and
 * keeps the scenario separate from calibrated real-world forecasts.
 */
export type TwinNode =
  | "POLICY_RATE"|"MORTGAGE_RATE"|"CREDIT"|"EMPLOYMENT"|"INCOME"
  | "DEMAND"|"INVENTORY"|"DOM"|"TRANSACTION_PRICE"|"RENT"|"LIQUIDITY"
  | "CONSTRUCTION"|"MIGRATION";

export interface TwinState { node:TwinNode; value:number; unit?:string; }
export interface TwinShock { node:TwinNode; delta:number; label:string; }
export interface TwinEdge {
 from:TwinNode; to:TwinNode; sign:1|-1; transmission:number; lagMonths:number;
 mechanism:string;
}
export interface TwinStep {
 month:number; node:TwinNode; before:number; after:number; delta:number;
 mechanism:string;
}
export interface FutureMarketTwinInput {
 initial:TwinState[];
 shocks:TwinShock[];
 edges:TwinEdge[];
 months:number;
 uncertainty:number;
}
export interface FutureMarketTwinOutput {
 months:number;
 finalState:TwinState[];
 path:TwinStep[];
 scenarioImpact:number;
 uncertainty:number;
 sensitivity:{shock:string;impact:number}[];
 audit:string[];
}

const clamp=(x:number,a=0,b=1)=>Math.min(b,Math.max(a,x));

const DEFAULT_EDGES:TwinEdge[]=[
 {from:"POLICY_RATE",to:"MORTGAGE_RATE",sign:1,transmission:.75,lagMonths:1,mechanism:"funding transmission"},
 {from:"MORTGAGE_RATE",to:"CREDIT",sign:-1,transmission:.60,lagMonths:2,mechanism:"affordability and underwriting"},
 {from:"CREDIT",to:"DEMAND",sign:1,transmission:.65,lagMonths:2,mechanism:"purchasing capacity"},
 {from:"EMPLOYMENT",to:"DEMAND",sign:1,transmission:.55,lagMonths:2,mechanism:"job security"},
 {from:"MIGRATION",to:"DEMAND",sign:1,transmission:.45,lagMonths:4,mechanism:"household formation"},
 {from:"CONSTRUCTION",to:"INVENTORY",sign:1,transmission:.70,lagMonths:6,mechanism:"new supply"},
 {from:"DEMAND",to:"DOM",sign:-1,transmission:.60,lagMonths:1,mechanism:"absorption"},
 {from:"INVENTORY",to:"DOM",sign:1,transmission:.70,lagMonths:1,mechanism:"competition"},
 {from:"DOM",to:"TRANSACTION_PRICE",sign:-1,transmission:.35,lagMonths:2,mechanism:"seller concessions"},
 {from:"RENT",to:"TRANSACTION_PRICE",sign:1,transmission:.25,lagMonths:3,mechanism:"income capitalization"},
 {from:"TRANSACTION_PRICE",to:"LIQUIDITY",sign:1,transmission:.30,lagMonths:1,mechanism:"collateral and confidence"},
];

export function runFutureMarketTwin(input:FutureMarketTwinInput):FutureMarketTwinOutput{
 const values=new Map<TwinNode,number>(input.initial.map(x=>[x.node,x.value]));
 const base=new Map(values);
 const path:TwinStep[]=[];
 const edges=input.edges.length?input.edges:DEFAULT_EDGES;
 const shocks=[...input.shocks];

 for(const shock of shocks){
  const before=values.get(shock.node)??0;
  values.set(shock.node,before+shock.delta);
  path.push({month:0,node:shock.node,before,after:before+shock.delta,delta:shock.delta,mechanism:`shock: ${shock.label}`});
 }

 for(let month=1;month<=Math.max(1,input.months);month++){
  const pending=new Map<TwinNode,number>();
  for(const e of edges){
   if(e.lagMonths!==month&&e.lagMonths>0)continue;
   const source=values.get(e.from)??0;
   const sourceBase=base.get(e.from)??0;
   const sourceDelta=source-sourceBase;
   if(Math.abs(sourceDelta)<1e-12)continue;
   const propagated=sourceDelta*e.sign*e.transmission;
   pending.set(e.to,(pending.get(e.to)??0)+propagated);
   const before=values.get(e.to)??0;
   path.push({month,node:e.to,before,after:before+propagated,delta:propagated,mechanism:e.mechanism});
  }
  for(const [node,delta] of pending)values.set(node,(values.get(node)??0)+delta);
 }

 const finalState=[...values.entries()].map(([node,value])=>({node,value}));
 const initialMagnitude=Math.max(1,shocks.reduce((s,x)=>s+Math.abs(x.delta),0));
 const priceDelta=(values.get("TRANSACTION_PRICE")??0)-(base.get("TRANSACTION_PRICE")??0);
 const scenarioImpact=clamp(Math.abs(priceDelta)/initialMagnitude);
 const uncertainty=clamp(input.uncertainty+.15*Math.min(1,shocks.length/4)+.10*(1-scenarioImpact));

 const sensitivity=shocks.map(shock=>{
  const gain=path.filter(p=>p.mechanism.includes(shock.label))
    .reduce((s,p)=>s+Math.abs(p.delta),0);
  return{shock:shock.label,impact:gain};
 }).sort((a,b)=>b.impact-a.impact);

 return{
  months:Math.max(1,input.months),finalState,path,scenarioImpact,uncertainty,sensitivity,
  audit:[
   "This is a structural counterfactual scenario, not a calibrated forecast.",
   "Shock transmission follows explicit signed mechanisms and lags.",
   "Uncertainty rises with multiple interacting shocks and weak scenario impact.",
   "Empirical calibration must come from historical replay before scenario probabilities are trusted."
  ]
 };
}
