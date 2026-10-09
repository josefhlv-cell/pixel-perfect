/**
 * Reality Investor — Counterfactual Buyer Lab.
 *
 * A property is not intrinsically a BUY/WAIT/PASS asset. The decision depends
 * on financing, horizon, risk tolerance and the investor's objective.
 *
 * The lab evaluates the same forecast under multiple buyer policies and
 * searches for decisions that remain good when assumptions change.
 */

export type BuyerProfile =
  | "CASH_INVESTOR"
  | "LEVERAGED_INVESTOR"
  | "VALUE_INVESTOR"
  | "INCOME_INVESTOR"
  | "LOW_RISK_INVESTOR";

export type BuyerAction="BUY"|"NEGOTIATE"|"WAIT"|"PASS";

export interface BuyerScenario {
  profile:BuyerProfile;
  ltv:number;
  interestRate:number;
  horizonYears:number;
  riskAversion:number;
  vacancyRate:number;
  rentGrowth:number;
}

export interface PropertyEconomics {
  price:number;
  fairValue:number;
  p10Value:number;
  p90Value:number;
  annualRent:number;
  expectedAppreciation:number;
  probabilityPositive:number;
}

export interface BuyerDecision {
  profile:BuyerProfile;
  action:BuyerAction;
  expectedReturnBps:number;
  downsideBps:number;
  utilityBps:number;
  robustness:number;
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

export function evaluateBuyer(
  p:PropertyEconomics,
  b:BuyerScenario,
):BuyerDecision{
  const equity=Math.max(1,p.price*(1-b.ltv));
  const leverageGain=(p.price*b.ltv*(p.expectedAppreciation-b.interestRate))/equity;
  const rentYield=(p.annualRent/p.price)*(1-b.vacancyRate);
  const grossAnnual=rentYield+p.expectedAppreciation+leverageGain;
  const downside=(p.p10Value/p.price-1)*10000;
  const returnBps=(Math.pow(1+grossAnnual,b.horizonYears)-1)*10000;
  const utility=returnBps-b.riskAversion*Math.abs(Math.min(0,downside));

  const action:BuyerAction=
    utility>1500&&p.probabilityPositive>.65?"BUY":
    utility>500?"NEGOTIATE":
    utility>-500?"WAIT":"PASS";

  const robustness=clamp(
    0.40*p.probabilityPositive+
    0.25*(p.p10Value/p.price)+
    0.20*(1-b.riskAversion)+
    0.15*(1-b.ltv),
    0,1
  );

  return {
    profile:b.profile,
    action,
    expectedReturnBps:returnBps,
    downsideBps:downside,
    utilityBps:utility,
    robustness
  };
}

export function buyerRobustness(
  p:PropertyEconomics,
  scenarios:BuyerScenario[],
){
  const decisions=scenarios.map(x=>evaluateBuyer(p,x));
  const buyRate=decisions.filter(x=>x.action==="BUY"||x.action==="NEGOTIATE").length/Math.max(1,decisions.length);
  const actionAgreement=decisions.filter(x=>x.action===decisions[0]?.action).length/Math.max(1,decisions.length);
  const averageUtility=decisions.reduce((s,x)=>s+x.utilityBps,0)/Math.max(1,decisions.length);

  return {
    decisions,
    robustOpportunity:buyRate>=.70&&actionAgreement>=.60,
    buyRate,
    actionAgreement,
    averageUtility
  };
}
