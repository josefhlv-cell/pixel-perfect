/**
 * Reality Investor — Future State Lab.
 *
 * Turns a point forecast into a finite set of competing future hypotheses.
 * Each hypothesis has observable triggers and invalidators. Later observations
 * can score which future is winning without hindsight relabeling.
 *
 * This is a hypothesis engine, not clairvoyance.
 */

export type FutureHypothesisId=
  |"ACCELERATION"
  |"SOFT_LANDING"
  |"DECELERATION"
  |"CORRECTION"
  |"LIQUIDITY_CRISIS"
  |"RECOVERY";

export interface FutureStateVector {
  horizonMonths:number;
  priceGrowth:number;
  rentGrowth:number;
  inventoryGrowth:number;
  mortgageRateChange:number;
  creditGrowth:number;
  domChange:number;
  liquidity:number;
  supplyGrowth:number;
}

export interface FutureHypothesis {
  id:FutureHypothesisId;
  probability:number;
  expectedPriceGrowth:number;
  expectedRentGrowth:number;
  confidence:number;
  triggers:string[];
  invalidators:string[];
  leadingSignals:string[];
}

export interface FutureLabResult {
  hypotheses:FutureHypothesis[];
  winner:FutureHypothesisId;
  entropy:number;
  transitionRisk:number;
  nextObservation:string;
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

function softmax(xs:number[]):number[]{
  const m=Math.max(...xs);
  const ex=xs.map(x=>Math.exp(x-m));
  const s=ex.reduce((a,b)=>a+b,0)||1;
  return ex.map(x=>x/s);
}

function entropy(ps:number[]):number{
  return -ps.reduce((s,p)=>s+(p>0?p*Math.log(p):0),0)/Math.log(Math.max(2,ps.length));
}

export function futureStateLab(v:FutureStateVector):FutureLabResult{
  const scores=[
    v.priceGrowth*.9-v.inventoryGrowth*.45-v.domChange*.25+v.creditGrowth*.25,
    .04-Math.abs(v.priceGrowth-.03)*.5-Math.abs(v.mortgageRateChange)*.35,
    -.35*v.priceGrowth+.45*v.inventoryGrowth+.25*v.domChange,
    -.75*v.priceGrowth+.8*v.inventoryGrowth+.5*v.mortgageRateChange-v.creditGrowth*.25,
    -v.liquidity*.9+v.domChange*.7+v.mortgageRateChange*.5,
    -.45*v.priceGrowth+.35*v.rentGrowth-v.inventoryGrowth*.4+v.creditGrowth*.25,
  ];
  const probs=softmax(scores.map(x=>x*3));
  const ids:FutureHypothesisId[]=[
    "ACCELERATION","SOFT_LANDING","DECELERATION","CORRECTION","LIQUIDITY_CRISIS","RECOVERY"
  ];
  const templates:Record<FutureHypothesisId,{pg:number;rg:number;t:string[];i:string[];s:string[]}>={
    ACCELERATION:{pg:.08,rg:.05,t:["inventory contraction","credit acceleration","falling mortgage rates"],i:["DOM rises materially","inventory expands"],s:["new listings","mortgage approvals","search demand"]},
    SOFT_LANDING:{pg:.03,rg:.025,t:["stable rates","income growth","balanced inventory"],i:["credit contraction","liquidity shock"],s:["wages","transaction volume","DOM"]},
    DECELERATION:{pg:.005,rg:.02,t:["DOM deterioration","inventory rebuilding","slower credit"],i:["inventory collapse","rate cuts"],s:["DOM","withdrawals","price reductions"]},
    CORRECTION:{pg:-.07,rg:-.01,t:["inventory surge","credit contraction","higher rates"],i:["rapid liquidity recovery","rate cuts"],s:["mortgage rates","new supply","transactions"]},
    LIQUIDITY_CRISIS:{pg:-.10,rg:-.02,t:["DOM surge","withdrawal surge","credit stress"],i:["transaction recovery","falling financing costs"],s:["time-on-market","withdrawals","failed deals"]},
    RECOVERY:{pg:.015,rg:.025,t:["rent resilience","falling rates","inventory absorption"],i:["employment shock","supply surge"],s:["rent","vacancy","mortgage rates"]},
  };

  const hypotheses=ids.map((id,i)=>{
    const t=templates[id];
    return {
      id,
      probability:probs[i]!,
      expectedPriceGrowth:t.pg*v.horizonMonths/12,
      expectedRentGrowth:t.rg*v.horizonMonths/12,
      confidence:clamp(.35+.55*(1-entropy(probs)),.15,.90),
      triggers:t.t,
      invalidators:t.i,
      leadingSignals:t.s,
    };
  }).sort((a,b)=>b.probability-a.probability);

  const transitionRisk=clamp(
    Math.abs(v.mortgageRateChange)*2+
    Math.abs(v.inventoryGrowth)*1.2+
    Math.abs(v.creditGrowth)*.9+
    Math.max(0,v.domChange)*.8,
    0,1
  );

  return {
    hypotheses,
    winner:hypotheses[0]!.id,
    entropy:entropy(hypotheses.map(x=>x.probability)),
    transitionRisk,
    nextObservation:hypotheses[0]!.leadingSignals[0]!,
  };
}
