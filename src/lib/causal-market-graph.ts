/**
 * Causal Market Graph — mechanism graph for explanations and intervention tests.
 * Edges are structural hypotheses until learned from point-in-time data.
 */
export type NodeId="POLICY_RATE"|"MORTGAGE_RATE"|"CREDIT"|"EMPLOYMENT"|"INCOME"|"DEMAND"|"INVENTORY"|"DOM"|"TRANSACTION_PRICE"|"RENT"|"LIQUIDITY";
export interface CausalEdge{from:NodeId;to:NodeId;sign:1|-1;lagMonths:number;strength:number;mechanism:string;}
export const DEFAULT_CAUSAL_EDGES:CausalEdge[]=[
 {from:"POLICY_RATE",to:"MORTGAGE_RATE",sign:1,lagMonths:1,strength:.8,mechanism:"funding transmission"},
 {from:"MORTGAGE_RATE",to:"CREDIT",sign:-1,lagMonths:2,strength:.7,mechanism:"affordability/underwriting"},
 {from:"CREDIT",to:"DEMAND",sign:1,lagMonths:2,strength:.7,mechanism:"purchasing capacity"},
 {from:"EMPLOYMENT",to:"DEMAND",sign:1,lagMonths:2,strength:.6,mechanism:"income/job security"},
 {from:"DEMAND",to:"DOM",sign:-1,lagMonths:1,strength:.7,mechanism:"absorption"},
 {from:"INVENTORY",to:"DOM",sign:1,lagMonths:1,strength:.8,mechanism:"competition"},
 {from:"DOM",to:"TRANSACTION_PRICE",sign:-1,lagMonths:2,strength:.5,mechanism:"seller concessions"},
 {from:"INCOME",to:"RENT",sign:1,lagMonths:3,strength:.5,mechanism:"rent affordability"},
 {from:"RENT",to:"TRANSACTION_PRICE",sign:1,lagMonths:3,strength:.35,mechanism:"income capitalization"},
 {from:"TRANSACTION_PRICE",to:"LIQUIDITY",sign:1,lagMonths:1,strength:.4,mechanism:"collateral/market confidence"},
];
export interface CausalPath{nodes:NodeId[];effect:number;lagMonths:number;mechanisms:string[];}
export function findCausalPaths(from:NodeId,to:NodeId,edges=CausalEdgeSet()):CausalPath[]{
 const out:CausalPath[]=[]; const walk=(n:NodeId,path:NodeId[],effect:number,lag:number,mechs:string[])=>{
  if(path.length>6)return; if(n===to){out.push({nodes:path,effect,lagMonths:lag,mechanisms:mechs});return;}
  for(const e of edges.filter(x=>x.from===n)){
   if(path.includes(e.to))continue;
   walk(e.to,[...path,e.to],effect*e.sign*e.strength,lag+e.lagMonths,[...mechs,e.mechanism]);
  }
 }; walk(from,[from],1,0,[]); return out.sort((a,b)=>Math.abs(b.effect)-Math.abs(a.effect));
}
function CausalEdgeSet(){return DEFAULT_CAUSAL_EDGES;}
