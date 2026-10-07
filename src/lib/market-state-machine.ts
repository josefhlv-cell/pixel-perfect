/**
 * Reality Investor — Market State Machine.
 *
 * A market does not have one permanent forecasting model. Model skill changes
 * with liquidity, volatility, inventory, transaction density and regime.
 *
 * This module creates an explicit state vector, detects transitions and routes
 * model trust accordingly. It is a deterministic governance layer until real
 * out-of-sample model performance is available.
 */

export type MarketState=
  |"EARLY_RECOVERY"
  |"EXPANSION"
  |"LATE_EXPANSION"
  |"DECELERATION"
  |"CORRECTION"
  |"LIQUIDITY_STRESS"
  |"STRUCTURAL_SHIFT"
  |"DATA_STARVED";

export interface MarketStateVector {
  priceGrowth:number;
  rentGrowth:number;
  inventoryGrowth:number;
  domGrowth:number;
  liquidity:number;
  volatility:number;
  transactionDensity:number;
  mortgageRateChange:number;
  creditGrowth:number;
  supplyGrowth:number;
  evidenceQuality:number;
}

export interface StateTransition {
  from:MarketState;
  to:MarketState;
  score:number;
  triggers:string[];
  invalidators:string[];
}

export interface ModelRouting {
  model:"HEDONIC"|"BOOSTING"|"SPATIAL"|"TEMPORAL"|"MACRO"|"BEHAVIORAL";
  weight:number;
  reason:string;
}

export interface MarketStateResult {
  state:MarketState;
  stateConfidence:number;
  vector:MarketStateVector;
  transition:StateTransition;
  routing:ModelRouting[];
  watchTriggers:string[];
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

export function inferMarketState(v:MarketStateVector):MarketState{
  if(v.evidenceQuality<.20||v.transactionDensity<.10)return "DATA_STARVED";
  if(v.liquidity<.25&&v.domGrowth>.20)return "LIQUIDITY_STRESS";
  if(v.inventoryGrowth>.20&&v.priceGrowth<-.03)return "CORRECTION";
  if(v.priceGrowth<-.02&&v.rentGrowth>0)return "EARLY_RECOVERY";
  if(v.priceGrowth>.06&&v.inventoryGrowth<-.05)return "EXPANSION";
  if(v.priceGrowth>.04&&v.domGrowth>.15)return "LATE_EXPANSION";
  if(v.priceGrowth<.01&&v.domGrowth>.10)return "DECELERATION";
  if(Math.abs(v.priceGrowth)<.02&&Math.abs(v.rentGrowth)<.02)return "STRUCTURAL_SHIFT";
  return "EXPANSION";
}

function routingFor(state:MarketState,v:MarketStateVector):ModelRouting[]{
  const base:Record<ModelRouting["model"],number>={
    HEDONIC:.14,BOOSTING:.20,SPATIAL:.20,TEMPORAL:.18,MACRO:.14,BEHAVIORAL:.14
  };
  if(state==="DATA_STARVED"){
    base.HEDONIC=.30;base.SPATIAL=.25;base.BOOSTING=.10;base.BEHAVIORAL=.05;
  }
  if(state==="EXPANSION"){
    base.BOOSTING=.25;base.SPATIAL=.22;base.TEMPORAL=.20;
  }
  if(state==="LATE_EXPANSION"){
    base.TEMPORAL=.25;base.MACRO=.22;base.BEHAVIORAL=.20;base.BOOSTING=.15;
  }
  if(state==="DECELERATION"){
    base.TEMPORAL=.25;base.MACRO=.24;base.BEHAVIORAL=.18;
  }
  if(state==="CORRECTION"){
    base.MACRO=.25;base.TEMPORAL=.25;base.SPATIAL=.20;base.BEHAVIORAL=.15;
  }
  if(state==="LIQUIDITY_STRESS"){
    base.BEHAVIORAL=.25;base.TEMPORAL=.22;base.MACRO=.20;base.SPATIAL=.18;
  }
  if(state==="EARLY_RECOVERY"){
    base.MACRO=.23;base.TEMPORAL=.23;base.SPATIAL=.20;base.BOOSTING=.18;
  }
  if(state==="STRUCTURAL_SHIFT"){
    base.SPATIAL=.24;base.HEDONIC=.20;base.MACRO=.20;base.TEMPORAL=.16;
  }
  const reasons:Record<ModelRouting["model"],string>={
    HEDONIC:"stabilní atributové vztahy a interpretovatelnost",
    BOOSTING:"nelinearity a interakce",
    SPATIAL:"lokální heterogenita",
    TEMPORAL:"časová dynamika a drift",
    MACRO:"citlivost na sazby, úvěry a ekonomiku",
    BEHAVIORAL:"likvidita, DOM a chování nabídky"
  };
  return Object.entries(base)
    .map(([model,weight])=>({model:model as ModelRouting["model"],weight,reason:reasons[model as ModelRouting["model"]]}))
    .sort((a,b)=>b.weight-a.weight);
}

export function marketStateMachine(v:MarketStateVector):MarketStateResult{
  const state=inferMarketState(v);
  const scoreParts=[
    v.evidenceQuality,
    clamp(v.transactionDensity,0,1),
    clamp(v.liquidity,0,1),
    1-clamp(v.volatility/0.30,0,1)
  ];
  const stateConfidence=clamp(scoreParts.reduce((a,b)=>a+b,0)/scoreParts.length,0.05,.95);

  const triggers:string[]=[];
  if(v.priceGrowth>.05)triggers.push("price acceleration");
  if(v.inventoryGrowth<-.05)triggers.push("inventory contraction");
  if(v.domGrowth>.15)triggers.push("time-on-market deterioration");
  if(v.liquidity<.35)triggers.push("liquidity deterioration");
  if(Math.abs(v.mortgageRateChange)>.01)triggers.push("financing regime change");
  if(v.creditGrowth<-.03)triggers.push("credit contraction");
  if(v.supplyGrowth>.08)triggers.push("supply acceleration");

  const transition:StateTransition={
    from:state,to:state,score:0,triggers,invalidators:[]
  };

  const watchTriggers:string[]=[
    "Přechod režimu potvrď až po více nezávislých signálech.",
    "Při změně režimu sniž důvěru ve staré OOS výsledky.",
  ];
  if(state==="LATE_EXPANSION")watchTriggers.push("Sleduj DOM, inventory a mortgage rates: možné předzvěsti decelerace.");
  if(state==="LIQUIDITY_STRESS")watchTriggers.push("Nezaměňuj nízké ceny za value: nejdříve ověř exit liquidity.");
  if(state==="DATA_STARVED")watchTriggers.push("Priorita je získat transakční a lokální data před agresivním rozhodnutím.");

  return {state,stateConfidence,vector:v,transition,routing:routingFor(state,v),watchTriggers};
}
