/**
 * Reality Investor — Deal Decision Certificate.
 *
 * Converts a probabilistic forecast into an auditable decision certificate.
 * It answers four questions:
 * 1) Is the current action invariant across plausible futures?
 * 2) How much uncertainty can the deal absorb before the action flips?
 * 3) What purchase price still leaves a model-risk margin of safety?
 * 4) Which missing observation is most likely to change the decision?
 *
 * This is a decision layer, not a claim of causal truth or financial advice.
 */

export type CertificateAction="BUY_NOW"|"NEGOTIATE"|"WAIT"|"PASS";
export type CertificateStatus="ROBUST"|"FRAGILE"|"UNSTABLE"|"INSUFFICIENT_EVIDENCE";

export interface DealDecisionInput {
  purchasePrice:number;
  fairValue:number;
  expectedReturn:number;
  downsideCvar:number;
  probabilityPositive:number;
  confidence:number;
  liquidity:number;
  modelRisk:number;
  evidenceQuality:number;
  negotiationEdge:number;
}

export interface FutureShock {
  id:string;
  expectedReturnDelta:number;
  fairValueDelta:number;
  liquidityDelta:number;
  modelRiskDelta:number;
  probabilityPositiveDelta:number;
}

export interface DecisionCertificate {
  action:CertificateAction;
  status:CertificateStatus;
  score:number;
  agreement:number;
  survivalRate:number;
  switchingThreshold:number;
  maxSafePurchasePrice:number;
  marginOfSafety:number;
  worstCaseUtility:number;
  bestCaseUtility:number;
  regret:number;
  dominantReasons:string[];
  invalidators:string[];
  nextBestObservations:string[];
  audit:string[];
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

function decide(x:DealDecisionInput):CertificateAction{
  const margin=(x.fairValue-x.purchasePrice)/Math.max(1,x.purchasePrice);
  const utility=x.expectedReturn
    +x.probabilityPositive*.08
    +x.liquidity*.03
    +x.negotiationEdge*.04
    -Math.max(0,-x.downsideCvar)*.35
    -x.modelRisk*.30;
  if(x.evidenceQuality<.30||x.confidence<.20||x.modelRisk>.78)return "PASS";
  if(margin>=.15&&utility>=.06&&x.confidence>=.45)return "BUY_NOW";
  if(margin>=.07&&utility>=.025)return "NEGOTIATE";
  if(utility>=0)return "WAIT";
  return "PASS";
}

function utility(x:DealDecisionInput):number{
  return x.expectedReturn
    +x.probabilityPositive*.08
    +x.liquidity*.03
    +x.negotiationEdge*.04
    -Math.max(0,-x.downsideCvar)*.35
    -x.modelRisk*.30;
}

export function decisionCertificate(
  base:DealDecisionInput,
  shocks:FutureShock[]=[
    {id:"BASE",expectedReturnDelta:0,fairValueDelta:0,liquidityDelta:0,modelRiskDelta:0,probabilityPositiveDelta:0},
    {id:"RATE_UP",expectedReturnDelta:-.04,fairValueDelta:-.07,liquidityDelta:-.12,modelRiskDelta:.10,probabilityPositiveDelta:-.12},
    {id:"CREDIT_STRESS",expectedReturnDelta:-.07,fairValueDelta:-.10,liquidityDelta:-.20,modelRiskDelta:.16,probabilityPositiveDelta:-.20},
    {id:"SUPPLY_SURGE",expectedReturnDelta:-.025,fairValueDelta:-.05,liquidityDelta:-.10,modelRiskDelta:.06,probabilityPositiveDelta:-.08},
    {id:"SOFT_LANDING",expectedReturnDelta:.025,fairValueDelta:.04,liquidityDelta:.08,modelRiskDelta:-.04,probabilityPositiveDelta:.07},
    {id:"RATE_CUT",expectedReturnDelta:.045,fairValueDelta:.08,liquidityDelta:.10,modelRiskDelta:-.05,probabilityPositiveDelta:.10},
  ],
):DecisionCertificate{
  if(!(base.purchasePrice>0&&base.fairValue>0)||base.evidenceQuality<.15){
    return {
      action:"PASS",status:"INSUFFICIENT_EVIDENCE",score:0,agreement:0,survivalRate:0,
      switchingThreshold:0,maxSafePurchasePrice:0,marginOfSafety:0,
      worstCaseUtility:0,bestCaseUtility:0,regret:0,
      dominantReasons:["Nedostatek spolehlivých dat pro rozhodnutí."],
      invalidators:["Doplň transakční cenu/férovou hodnotu a OOS kalibraci."],
      nextBestObservations:["ověřená transakční cena","lokální srovnatelné transakce","aktuální nájem"],
      audit:["Certificate blocked: insufficient evidence."]
    };
  }

  const scenarioRows=shocks.map(s=>{
    const x:DealDecisionInput={
      ...base,
      expectedReturn:base.expectedReturn+s.expectedReturnDelta,
      fairValue:base.fairValue*(1+s.fairValueDelta),
      liquidity:clamp(base.liquidity+s.liquidityDelta,0,1),
      modelRisk:clamp(base.modelRisk+s.modelRiskDelta,0,1),
      probabilityPositive:clamp(base.probabilityPositive+s.probabilityPositiveDelta,0,1),
    };
    const u=utility(x);
    const action=decide(x);
    return {id:s.id,action,utility:u,survival:action!=="PASS"};
  });

  const counts=new Map<CertificateAction,number>();
  for(const r of scenarioRows)counts.set(r.action,(counts.get(r.action)||0)+1);
  const dominant=[...counts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]??"PASS";
  const agreement=(counts.get(dominant)||0)/scenarioRows.length;
  const survivalRate=scenarioRows.filter(r=>r.survival).length/scenarioRows.length;
  const utilities=scenarioRows.map(r=>r.utility);
  const best=Math.max(...utilities),worst=Math.min(...utilities);
  const dominantUtilities=scenarioRows.filter(r=>r.action===dominant).map(r=>r.utility);
  const regret=Math.max(0,best-(dominantUtilities.length?Math.min(...dominantUtilities):worst));

  // Switching threshold: fraction of the current margin that can be consumed
  // before the action changes under a monotone deterioration path.
  const current=decide(base);
  const currentMargin=(base.fairValue-base.purchasePrice)/Math.max(1,base.purchasePrice);
  let switchingThreshold=1;
  for(let i=1;i<=100;i++){
    const stress=i/100;
    const x:DealDecisionInput={
      ...base,
      fairValue:base.fairValue*(1-.45*stress),
      expectedReturn:base.expectedReturn-.15*stress,
      liquidity:clamp(base.liquidity-.35*stress,0,1),
      modelRisk:clamp(base.modelRisk+.35*stress,0,1),
      probabilityPositive:clamp(base.probabilityPositive-.30*stress,0,1),
    };
    if(decide(x)!==current){switchingThreshold=stress;break;}
  }

  const marginOfSafety=clamp(
    currentMargin
      -Math.max(0,-base.downsideCvar)*.35
      -base.modelRisk*.25
      -(1-base.confidence)*.15,
    -1,1,
  );
  const maxSafePurchasePrice=Math.max(
    0,
    base.fairValue*(1-clamp(.08+base.modelRisk*.25+(1-base.confidence)*.15,0,.45))
  );

  const status:CertificateStatus=
    agreement>=.80&&survivalRate>=.80&&switchingThreshold>=.35?"ROBUST":
    agreement>=.60&&survivalRate>=.65?"FRAGILE":"UNSTABLE";

  const reasons:string[]=[];
  if(agreement>=.80)reasons.push("Rozhodnutí přežívá většinu plausibilních scénářů.");
  if(switchingThreshold>=.35)reasons.push("Model má relativně velkou bezpečnostní rezervu před překlopením akce.");
  if(base.negotiationEdge>.05)reasons.push("Vyjednávací prostor zvyšuje asymetrii obchodu.");
  if(base.liquidity>.65)reasons.push("Likvidita tlumí část downside rizika.");
  if(base.modelRisk>.45)reasons.push("Modelové riziko významně spotřebovává margin of safety.");

  const invalidators:string[]=[];
  if(base.evidenceQuality<.50)invalidators.push("Slabá kvalita evidence.");
  if(base.confidence<.45)invalidators.push("Nízká predikční jistota.");
  if(base.modelRisk>.55)invalidators.push("Příliš vysoké modelové riziko.");
  if(base.liquidity<.35)invalidators.push("Nízká pravděpodobnost rychlého výstupu.");
  if(currentMargin<.07)invalidators.push("Malá rezerva mezi cenou a férovou hodnotou.");

  const nextBestObservations=[
    ...(base.evidenceQuality<.60?["ověřená lokální transakční cena"]:[]),
    ...(base.liquidity<.60?["reálné lokální doby prodeje a withdrawal rate"]:[]),
    ...(base.expectedReturn<.06?["aktuální nájem a čistý cash-flow po nákladech"]:[]),
    ...(base.modelRisk>.45?["nové OOS chyby modelu v daném mikromarketu"]:[]),
  ].slice(0,4);

  const score=100*clamp(
    agreement*.25+survivalRate*.15+Math.max(0,base.probabilityPositive)*.15+
    base.confidence*.15+(1-base.modelRisk)*.15+clamp(marginOfSafety,0,1)*.10+
    base.evidenceQuality*.05,0,1
  );

  return {
    action:dominant,
    status,
    score,
    agreement,
    survivalRate,
    switchingThreshold,
    maxSafePurchasePrice,
    marginOfSafety,
    worstCaseUtility:worst,
    bestCaseUtility:best,
    regret,
    dominantReasons:reasons.slice(0,5),
    invalidators:invalidators.slice(0,5),
    nextBestObservations,
    audit:[
      "Scénáře jsou stress/counterfactual paths, nikoli empirické pravděpodobnosti.",
      "Switching threshold měří citlivost rozhodnutí na zhoršení podmínek.",
      "Max safe purchase price je modelový risk-adjusted limit, nikoli znalecká hodnota.",
      `Current action before scenario sweep: ${current}.`,
    ],
  };
}
