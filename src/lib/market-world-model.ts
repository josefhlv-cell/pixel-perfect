/**
 * Reality Investor — World Model / Robust Scenario Lab.
 *
 * Purpose: turn a forecast distribution into a decision distribution.
 * This is a reproducible structural scenario engine, not a trained digital twin.
 * Its parameters MUST be calibrated against point-in-time transaction outcomes
 * before being presented as empirically validated market probabilities.
 */

export type Action="BUY_NOW"|"NEGOTIATE"|"WAIT"|"PASS";
export type ShockRegime="SOFT_LANDING"|"EXPANSION"|"RATE_SHOCK"|"CREDIT_STRESS"|"SUPPLY_SURGE"|"DEMAND_SHOCK";

export interface WorldState {
  priceGrowth:number;
  rentGrowth:number;
  mortgageRate:number;
  policyRate:number;
  inflation:number;
  incomeGrowth:number;
  unemployment:number;
  inventoryGrowth:number;
  demandGrowth:number;
  constructionGrowth:number;
  liquidity:number;
}

export interface Scenario {
  id:number;
  regime:ShockRegime;
  state:WorldState;
  propertyReturn:number;
  downside:number;
  liquidity:number;
  probability:number;
}

export interface ActionProfile {
  action:Action;
  expectedReturn:number;
  transactionCost:number;
  downsidePenalty:number;
  minSurvivalProbability:number;
  riskAversion:number;
}

export interface WorldModelResult {
  seed:number;
  scenarios:number;
  quantiles:{p05:number;p10:number;p25:number;p50:number;p75:number;p90:number;p95:number};
  expectedReturn:number;
  probabilityPositive:number;
  probabilityLossBeyond:number;
  var10:number;
  cvar10:number;
  worstDecileMean:number;
  survivalProbability:number;
  entropy:number;
  regimeMix:Record<ShockRegime,number>;
  robustAction:Action;
  actionUtilities:Record<Action,number>;
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));
const sigmoid=(x:number)=>1/(1+Math.exp(-x));

function rng(seed:number){
  let s=(seed|0)>>>0;
  return ()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296;};
}
function normal(rand:()=>number){
  let u=0,v=0;
  while(u===0)u=rand();
  while(v===0)v=rand();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
}
function quantile(xs:number[],q:number){
  const a=[...xs].sort((x,y)=>x-y);
  const p=(a.length-1)*q, lo=Math.floor(p), hi=Math.ceil(p);
  return a[lo]+(a[hi]-a[lo])*(p-lo);
}
function shannon(weights:number[]){
  return -weights.filter(Boolean).reduce((s,p)=>s+p*Math.log(p),0);
}

const REGIMES:ShockRegime[]=["SOFT_LANDING","EXPANSION","RATE_SHOCK","CREDIT_STRESS","SUPPLY_SURGE","DEMAND_SHOCK"];

function drawRegime(r:()=>number):ShockRegime{
  const u=r();
  if(u<.30)return "SOFT_LANDING";
  if(u<.50)return "EXPANSION";
  if(u<.67)return "RATE_SHOCK";
  if(u<.80)return "CREDIT_STRESS";
  if(u<.91)return "SUPPLY_SURGE";
  return "DEMAND_SHOCK";
}

function evolve(base:WorldState,regime:ShockRegime,z:()=>number):WorldState{
  const n=()=>normal(z);
  const s={...base};
  switch(regime){
    case "EXPANSION":
      s.priceGrowth+=.025+n()*.008;s.rentGrowth+=.012+n()*.005;s.demandGrowth+=.03+n()*.01;
      s.mortgageRate-=.004;s.liquidity+=.12;break;
    case "RATE_SHOCK":
      s.policyRate+=.015+n()*.004;s.mortgageRate+=.020+n()*.006;s.priceGrowth-=.035+n()*.012;
      s.demandGrowth-=.025;s.liquidity-=.15;break;
    case "CREDIT_STRESS":
      s.mortgageRate+=.012+n()*.005;s.priceGrowth-=.025+n()*.01;s.demandGrowth-=.04;
      s.unemployment+=.012;s.liquidity-=.22;break;
    case "SUPPLY_SURGE":
      s.inventoryGrowth+=.10+n()*.03;s.constructionGrowth+=.15+n()*.04;s.priceGrowth-=.018+n()*.008;
      s.rentGrowth-=.006;s.liquidity+=.03;break;
    case "DEMAND_SHOCK":
      s.demandGrowth-=.06+n()*.02;s.priceGrowth-=.045+n()*.015;s.rentGrowth-=.02;
      s.unemployment+=.02;s.liquidity-=.18;break;
    case "SOFT_LANDING":
      s.priceGrowth+=n()*.006;s.rentGrowth+=.005+n()*.004;s.liquidity+=n()*.04;break;
  }
  return s;
}

function returnFor(base:WorldState,s:WorldState){
  const financingDrag=(s.mortgageRate-base.mortgageRate)*1.8;
  const liquidityDrag=(.5-s.liquidity)*.05;
  return s.priceGrowth+s.rentGrowth*.45-financingDrag-liquidityDrag;
}

export function simulateWorld(base:WorldState, scenarios=10000, seed=20261007):WorldModelResult{
  if(!Number.isInteger(scenarios)||scenarios<100)return simulateWorld(base,10000,seed);
  const r=rng(seed), rows:Scenario[]=[];
  const regimeCounts=Object.fromEntries(REGIMES.map(x=>[x,0])) as Record<ShockRegime,number>;

  for(let i=0;i<scenarios;i++){
    const regime=drawRegime(r);
    const state=evolve(base,regime,r);
    const ret=returnFor(base,state);
    rows.push({id:i,regime,state,propertyReturn:ret,downside:Math.min(0,ret),liquidity:state.liquidity,probability:1/scenarios});
    regimeCounts[regime]++;
  }

  const returns=rows.map(x=>x.propertyReturn);
  const q={p05:quantile(returns,.05),p10:quantile(returns,.10),p25:quantile(returns,.25),p50:quantile(returns,.50),p75:quantile(returns,.75),p90:quantile(returns,.90),p95:quantile(returns,.95)};
  const var10=q.p10;
  const tail=returns.filter(x=>x<=var10);
  const cvar10=tail.reduce((a,b)=>a+b,0)/Math.max(1,tail.length);
  const positive=returns.filter(x=>x>0).length/scenarios;
  const lossBeyond=returns.filter(x=>x<-.10).length/scenarios;
  const survival=returns.filter(x=>x>-.15).length/scenarios;
  const mix=REGIMES.map(x=>regimeCounts[x]/scenarios);

  const actions:ActionProfile[]=[
    {action:"BUY_NOW",expectedReturn:q.p50,transactionCost:.04,downsidePenalty:Math.max(0,-cvar10),minSurvivalProbability:.70,riskAversion:1.0},
    {action:"NEGOTIATE",expectedReturn:q.p50+.025,transactionCost:.035,downsidePenalty:Math.max(0,-cvar10),minSurvivalProbability:.65,riskAversion:.9},
    {action:"WAIT",expectedReturn:q.p50-.005,transactionCost:.01,downsidePenalty:Math.max(0,-q.p05),minSurvivalProbability:.60,riskAversion:.6},
    {action:"PASS",expectedReturn:0,transactionCost:0,downsidePenalty:0,minSurvivalProbability:1,riskAversion:.2}
  ];
  const utilities=Object.fromEntries(actions.map(a=>{
    const utility=a.expectedReturn-a.transactionCost-a.riskAversion*a.downsidePenalty;
    const feasible=survival>=a.minSurvivalProbability;
    return [a.action,feasible?utility:-Infinity];
  })) as Record<Action,number>;
  const robustAction=([...Object.keys(utilities)] as Action[]).sort((a,b)=>utilities[b]-utilities[a])[0];

  return {
    seed,scenarios,quantiles:q,expectedReturn:returns.reduce((a,b)=>a+b,0)/scenarios,
    probabilityPositive:positive,probabilityLossBeyond:lossBeyond,var10,cvar10,
    worstDecileMean:cvar10,survivalProbability:survival,entropy:shannon(mix),
    regimeMix:Object.fromEntries(REGIMES.map((x,i)=>[x,mix[i]])) as Record<ShockRegime,number>,
    robustAction,actionUtilities:utilities
  };
}
