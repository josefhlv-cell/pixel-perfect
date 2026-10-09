/**
 * Reality Investor — Transition Hazard Engine.
 *
 * Estimates structural hazard of moving between future market regimes.
 * The matrix is intentionally interpretable and uncalibrated until fitted
 * against point-in-time historical regime transitions.
 */

import type {FutureHypothesisId, FutureStateVector} from "./future-state-lab";

export interface TransitionEdge {
  from:FutureHypothesisId;
  to:FutureHypothesisId;
  hazard:number;
  trigger:string;
  invalidator:string;
}

export interface TransitionHazardResult {
  current:FutureHypothesisId;
  edges:TransitionEdge[];
  nextLikelyTransition:TransitionEdge|null;
  transitionEntropy:number;
  calibrationStatus:"STRUCTURAL_UNCALIBRATED"|"EMPIRICALLY_CALIBRATED";
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

function entropy(ps:number[]):number{
  const p=ps.filter(x=>x>0);
  if(p.length<2)return 0;
  return clamp(-p.reduce((s,x)=>s+x*Math.log(x),0)/Math.log(p.length),0,1);
}

export function transitionHazard(
  state:FutureStateVector,
  current:FutureHypothesisId,
):TransitionHazardResult{
  const stress=clamp(
    Math.abs(state.mortgageRateChange)*2+
    Math.max(0,state.inventoryGrowth)*1.3+
    Math.max(0,state.domChange)*.8+
    Math.max(0,-state.creditGrowth)*1.1+
    Math.max(0,-state.liquidity)*.7,0,1);
  const momentum=clamp(
    Math.max(0,state.priceGrowth)*1.8+
    Math.max(0,state.creditGrowth)*.9+
    Math.max(0,-state.inventoryGrowth)*.8+
    Math.max(0,state.rentGrowth)*.5,0,1);
  const recovery=clamp(
    Math.max(0,-state.mortgageRateChange)*1.5+
    Math.max(0,state.rentGrowth)*.8+
    Math.max(0,-state.inventoryGrowth)*.9+
    Math.max(0,state.creditGrowth)*.7,0,1);

  const targets:Record<FutureHypothesisId,Array<[FutureHypothesisId,number,string,string]>>={
    ACCELERATION:[
      ["SOFT_LANDING",.25,"price momentum fades","renewed credit acceleration"],
      ["DECELERATION",.25+stress*.45,"inventory/DOM deteriorate","inventory contraction"],
      ["CORRECTION",.08+stress*.55,"financing stress rises","falling rates + liquidity recovery"],
      ["LIQUIDITY_CRISIS",.03+stress*.40,"DOM and withdrawals surge","transaction recovery"],
      ["RECOVERY",.06,"rent strengthens while rates fall","employment shock"],
      ["ACCELERATION",.02,"regime persists","none"],
    ],
    SOFT_LANDING:[
      ["ACCELERATION",.10+momentum*.30,"demand and credit strengthen","inventory rebuilds"],
      ["DECELERATION",.18+stress*.35,"DOM/inventory worsen","demand re-accelerates"],
      ["CORRECTION",.05+stress*.45,"rates or credit tighten","liquidity improves"],
      ["LIQUIDITY_CRISIS",.02+stress*.35,"transaction liquidity collapses","transactions recover"],
      ["RECOVERY",.10+recovery*.20,"rates fall and rents hold","employment shock"],
      ["SOFT_LANDING",.25,"signals remain balanced","none"],
    ],
    DECELERATION:[
      ["SOFT_LANDING",.18+recovery*.15,"demand stabilizes","inventory accelerates"],
      ["ACCELERATION",.08+momentum*.25,"credit and demand reaccelerate","rates rise"],
      ["CORRECTION",.20+stress*.35,"inventory/DOM continue worsening","liquidity recovers"],
      ["LIQUIDITY_CRISIS",.08+stress*.35,"failed transactions and withdrawals","transaction recovery"],
      ["RECOVERY",.12+recovery*.25,"financing eases","employment shock"],
      ["DECELERATION",.20,"weakness persists","none"],
    ],
    CORRECTION:[
      ["LIQUIDITY_CRISIS",.15+stress*.45,"DOM and failed deals accelerate","transaction recovery"],
      ["DECELERATION",.20+recovery*.20,"downturn loses force","inventory contracts"],
      ["RECOVERY",.18+recovery*.35,"rates fall and demand returns","employment shock"],
      ["SOFT_LANDING",.10+recovery*.15,"prices stabilize","new credit shock"],
      ["CORRECTION",.20,"negative momentum persists","none"],
      ["ACCELERATION",.03+momentum*.10,"strong demand returns","credit contraction"],
    ],
    LIQUIDITY_CRISIS:[
      ["CORRECTION",.25+recovery*.20,"liquidity improves but prices remain weak","withdrawals continue"],
      ["RECOVERY",.25+recovery*.35,"transactions and financing recover","employment shock"],
      ["DECELERATION",.15,"stress recedes","new credit shock"],
      ["LIQUIDITY_CRISIS",.20,"liquidity remains impaired","transaction recovery"],
      ["SOFT_LANDING",.05+recovery*.10,"prices stabilize","liquidity relapse"],
      ["ACCELERATION",.02,"demand shock reverses","credit stress"],
    ],
    RECOVERY:[
      ["SOFT_LANDING",.20+momentum*.15,"growth normalizes","rates rise"],
      ["ACCELERATION",.18+momentum*.35,"demand and credit accelerate","inventory surge"],
      ["DECELERATION",.12+stress*.25,"recovery loses momentum","financing eases"],
      ["CORRECTION",.04+stress*.25,"recovery breaks","liquidity improves"],
      ["LIQUIDITY_CRISIS",.02+stress*.20,"transactions collapse","credit recovery"],
      ["RECOVERY",.25,"recovery persists","none"],
    ],
  };

  const raw=targets[current]??[];
  const total=raw.reduce((s,x)=>s+x[1],0)||1;
  const edges=raw.map(([to,w,trigger,invalidator])=>({
    from:current,to,hazard:clamp(w/total,0,1),trigger,invalidator,
  })).sort((a,b)=>b.hazard-a.hazard);

  return {
    current,
    edges,
    nextLikelyTransition:edges[0]??null,
    transitionEntropy:entropy(edges.map(x=>x.hazard)),
    calibrationStatus:"STRUCTURAL_UNCALIBRATED",
  };
}
