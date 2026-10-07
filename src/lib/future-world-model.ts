/**
 * Future World Model — orchestration layer for Reality Investor.
 *
 * This is the system's "future reasoning" contract:
 * market state -> causal mechanisms -> competing futures -> leading signals
 * -> property future twin -> decision score.
 *
 * It deliberately returns uncertainty and invalidation conditions instead of
 * presenting structural scenarios as facts. Empirical calibration belongs to
 * the learning/replay pipeline once point-in-time outcomes exist.
 */
import {futureStateLab,type FutureStateVector,type FutureLabResult} from "./future-state-lab";
import {findCausalPaths,type NodeId} from "./causal-market-graph";
import {buildFutureScenarioStack,type ScenarioCase} from "./future-scenario-stack";
import {buildPropertyFutureTwin,type PropertyFutureTwin} from "./property-future-twin";
import {calculateFutureScore,type FutureScore} from "./future-score";

export interface WorldMarketInput extends FutureStateVector {
  evidence:number;
  modelRisk:number;
}

export interface WorldPropertyInput {
  price:number;
  fairValue:number;
  rent:number;
  rentGrowth:number;
  condition:number;
  locationScore:number;
  liquidity:number;
  confidence:number;
  modelRisk:number;
}

export interface FutureWorldModelInput {
  market:WorldMarketInput;
  property?:WorldPropertyInput;
  causalFocus?:{from:NodeId;to:NodeId};
}

export interface FutureSignal {
  horizonMonths:number;
  probability:number;
  impact:"POSITIVE"|"NEGATIVE"|"MIXED";
  signal:string;
  invalidator:string;
}

export interface FutureWorldModelOutput {
  version:"future-world-v1";
  market:FutureLabResult;
  scenarios:ScenarioCase[];
  causalPath:{nodes:NodeId[];effect:number;lagMonths:number;mechanisms:string[]}|null;
  signals:FutureSignal[];
  property:PropertyFutureTwin|null;
  futureScore:FutureScore|null;
  confidence:number;
  uncertainty:number;
  decision:"BUY"|"NEGOTIATE"|"WAIT"|"PASS";
  decisionReason:string[];
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

export function buildFutureWorldModel(input:FutureWorldModelInput):FutureWorldModelOutput{
  const m=input.market;
  const market=futureStateLab(m);
  const scenarios=buildFutureScenarioStack({
    growth:m.priceGrowth,
    rentGrowth:m.rentGrowth,
    liquidity:m.liquidity,
    inventory:m.inventoryGrowth,
    rateChange:m.mortgageRateChange,
    confidence:m.evidence,
  });

  const focus=input.causalFocus??{from:"POLICY_RATE" as NodeId,to:"TRANSACTION_PRICE" as NodeId};
  const causalPath=findCausalPaths(focus.from,focus.to)[0]??null;

  const winner=market.hypotheses[0]!;
  const signals:FutureSignal[]=winner.leadingSignals.slice(0,3).map((signal,i)=>({
    horizonMonths:Math.max(1,Math.round((i+1)*Math.max(1,winner.id==="LIQUIDITY_CRISIS"?2:4))),
    probability:clamp(winner.probability*(1-.12*i),.01,.99),
    impact:winner.expectedPriceGrowth>=0?"POSITIVE":"NEGATIVE",
    signal,
    invalidator:winner.invalidators[i%winner.invalidators.length]!,
  }));

  let property:PropertyFutureTwin|null=null;
  let futureScore:FutureScore|null=null;
  let decision:"BUY"|"NEGOTIATE"|"WAIT"|"PASS"="WAIT";
  const decisionReason:string[]=[];

  if(input.property){
    const p=input.property;
    property=buildPropertyFutureTwin({
      price:p.price,fairValue:p.fairValue,rent:p.rent,rentGrowth:p.rentGrowth,
      marketGrowth:m.priceGrowth,liquidity:p.liquidity,confidence:p.confidence,
      modelRisk:p.modelRisk,condition:p.condition,locationScore:p.locationScore,
    });

    const leadTime=signals.length?Math.max(...signals.map(s=>s.horizonMonths*30)):0;
    const upside=clamp(property.futureEdge,0,1);
    const downside=-clamp(property.downsideProbability,0,1);
    futureScore=calculateFutureScore({
      upsideProbability:property.upsideProbability,
      upside,
      downside,
      liquidity:p.liquidity,
      leadTime,
      evidence:m.evidence,
      robustness:1-property.fragility,
      uncertainty:clamp(market.entropy*.55+property.fragility*.45,0,1),
      modelRisk:Math.max(m.modelRisk,p.modelRisk),
    });

    if(futureScore.tier==="EXCEPTIONAL"&&property.fragility<.35)decision="BUY";
    else if(futureScore.tier==="STRONG")decision="NEGOTIATE";
    else if(futureScore.tier==="PASS")decision="PASS";

    decisionReason.push(`futureScore=${futureScore.score.toFixed(1)}`,`winner=${winner.id}`,`fragility=${property.fragility.toFixed(2)}`);
  } else {
    decisionReason.push(`marketFuture=${winner.id}`);
  }

  const confidence=clamp(.45*m.evidence+.35*(1-market.entropy)+.20*(1-m.modelRisk),0,1);
  const uncertainty=1-confidence;

  return {
    version:"future-world-v1",market,scenarios,causalPath,signals,property,futureScore,
    confidence,uncertainty,decision,
    decisionReason:[...decisionReason,`transitionRisk=${market.transitionRisk.toFixed(2)}`,`nextObservation=${market.nextObservation}`],
  };
}
