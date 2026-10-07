export type Action = "BUY"|"NEGOTIATE"|"WAIT"|"WATCH"|"PASS";

export interface DecisionCase {
  id:string;
  date:string;
  purchasePrice:number;
  realizedValue:number;
  realizedRent?:number|null;
  holdingMonths:number;
  transactionCostBps:number;
  financingCostBps:number;
  forecastP50:number;
  forecastP10:number;
  forecastP90:number;
  probabilityGain:number;
  probabilityLoss:number;
  recommendedAction:Action;
  alternativeAction:Action;
  modelConfidence:number;
}

export interface DecisionScore {
  id:string;
  chosenAction:Action;
  realizedReturnBps:number;
  downsideBps:number;
  regretBps:number;
  utilityBps:number;
  correctDirection:boolean;
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

export function expectedInvestmentUtility(x:DecisionCase):number{
  const upside=(x.forecastP90/x.purchasePrice-1)*10000;
  const downside=(x.forecastP10/x.purchasePrice-1)*10000;
  const expected=upside*x.probabilityGain+downside*x.probabilityLoss;
  return (expected-x.transactionCostBps-x.financingCostBps)*clamp(x.modelConfidence,0,1);
}

export function realizedReturn(x:DecisionCase):number{
  if(x.purchasePrice<=0)return -Infinity;
  const gross=(x.realizedValue/x.purchasePrice-1)*10000;
  const rent=(x.realizedRent??0)/x.purchasePrice*10000*(x.holdingMonths/12);
  return gross+rent-x.transactionCostBps-x.financingCostBps;
}

export function scoreDecision(x:DecisionCase):DecisionScore{
  const realized=realizedReturn(x);
  const utility=expectedInvestmentUtility(x);
  return {
    id:x.id,
    chosenAction:x.recommendedAction,
    realizedReturnBps:realized,
    downsideBps:Math.min(0,realized),
    regretBps:clamp(-realized,-100000,100000),
    utilityBps:utility,
    correctDirection:(x.forecastP50>=x.purchasePrice)===(x.realizedValue>=x.purchasePrice)
  };
}

export function decisionTournament(cases:DecisionCase[]){
  if(!cases.length)return {samples:0,averageReturnBps:0,averageRegretBps:0,directionAccuracy:0,positiveRate:0,utilityBps:0};
  const scores=cases.map(scoreDecision);
  return {
    samples:scores.length,
    averageReturnBps:scores.reduce((s,x)=>s+x.realizedReturnBps,0)/scores.length,
    averageRegretBps:scores.reduce((s,x)=>s+x.regretBps,0)/scores.length,
    directionAccuracy:scores.filter(x=>x.correctDirection).length/scores.length,
    positiveRate:scores.filter(x=>x.realizedReturnBps>0).length/scores.length,
    utilityBps:scores.reduce((s,x)=>s+x.utilityBps,0)/scores.length
  };
}

export function comparePredictionVsDecisionSkill(predictionScore:number,decisionScore:number){
  const p=clamp(predictionScore,0,1), d=clamp(decisionScore,0,1);
  return {
    predictionSkill:p, decisionSkill:d, gap:d-p,
    interpretation:d>p+0.10?"decisions outperform raw prediction quality":
      p>d+0.10?"prediction accuracy is not translating into decisions":
      "prediction and decision quality are aligned"
  };
}
