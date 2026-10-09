/**
 * Reality Investor — decision theory layer.
 *
 * Converts uncertain market outcomes into a risk-aware decision without
 * pretending that the highest expected return is automatically the best choice.
 */

export type DecisionAction="BUY_NOW"|"NEGOTIATE"|"WAIT"|"WATCH"|"PASS";

export interface DecisionInput{
  probabilityGain:number;
  probabilityLoss:number;
  expectedReturnBps:number;
  downsideP10Bps:number;
  liquidity:number;
  confidence:number;
  riskAversion?:number;
}

export interface DecisionOutput{
  action:DecisionAction;
  expectedUtility:number;
  riskAdjustedScore:number;
  rationale:string[];
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

export function decisionFromForecast(x:DecisionInput):DecisionOutput{
  const riskAversion=x.riskAversion??1.8;
  const downsidePenalty=Math.max(0,-x.downsideP10Bps)/10000;
  const expected=x.expectedReturnBps/10000;
  const utility=expected-(riskAversion*downsidePenalty*0.35);
  const riskAdjusted=clamp((utility*180+ x.probabilityGain*35 + x.liquidity*15)*x.confidence,0,100);
  const rationale:string[]=[];
  if(x.confidence<0.45)rationale.push("Nízká jistota modelu: preferuj WATCH před agresivním rozhodnutím.");
  if(x.downsideP10Bps<-1500)rationale.push("P10 scénář obsahuje významný downside.");
  if(x.probabilityGain>0.72&&utility>0.06)rationale.push("Asymetrie výsledků je příznivá pro kupujícího.");
  if(x.liquidity<0.35)rationale.push("Výstup může být obtížný; likvidita snižuje atraktivitu.");
  let action:DecisionAction="WATCH";
  if(x.confidence<0.30)action="WATCH";
  else if(riskAdjusted>=72)action="BUY_NOW";
  else if(riskAdjusted>=57)action="NEGOTIATE";
  else if(riskAdjusted>=40)action="WAIT";
  else action="PASS";
  return {action,expectedUtility:utility,riskAdjustedScore:riskAdjusted,rationale};
}
