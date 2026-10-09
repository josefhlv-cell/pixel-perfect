/**
 * Reality Investor — Strategy Regret Lab.
 *
 * Separates forecast-selection regret from investment-decision regret.
 * It evaluates historical actions using only the forecast information that
 * was available at the time, then compares realized utility afterwards.
 */

export interface StrategyActionCase {
  cutoff:string;
  strategyId:string;
  action:"BUY"|"NEGOTIATE"|"WAIT"|"PASS";
  realizedReturn:number;
  downside:number;
  decisionConfidence:number;
}

export interface StrategyRegretScore {
  strategyId:string;
  cases:number;
  realizedUtility:number;
  downsidePenalty:number;
  regretVsBest:number;
  robustRate:number;
}

const utility=(r:number,d:number,c:number)=>r-d*(1-c);

export function scoreStrategyRegret(
  cases:StrategyActionCase[],
):StrategyRegretScore[]{
  const strategies=[...new Set(cases.map(c=>c.strategyId))];
  return strategies.map(strategyId=>{
    const group=cases.filter(c=>c.strategyId===strategyId);
    const utilities=group.map(c=>utility(c.realizedReturn,c.downside,c.decisionConfidence));
    const realizedUtility=utilities.reduce((s,x)=>s+x,0)/Math.max(1,utilities.length);
    const downsidePenalty=group.reduce((s,c)=>s+c.downside,0)/Math.max(1,group.length);

    const contexts=group.map(c=>c.cutoff);
    let regret=0;
    let robust=0;
    for(const cutoff of contexts){
      const peers=cases.filter(c=>c.cutoff===cutoff);
      const actual=peers.map(c=>utility(c.realizedReturn,c.downside,c.decisionConfidence));
      const best=Math.max(...actual);
      const own=utility(
        group.find(c=>c.cutoff===cutoff)?.realizedReturn??0,
        group.find(c=>c.cutoff===cutoff)?.downside??0,
        group.find(c=>c.cutoff===cutoff)?.decisionConfidence??0,
      );
      regret+=Math.max(0,best-own);
      if(own>=best-.02)robust++;
    }

    return {
      strategyId,cases:group.length,realizedUtility,
      downsidePenalty,regretVsBest:regret/Math.max(1,contexts.length),
      robustRate:robust/Math.max(1,contexts.length),
    };
  }).sort((a,b)=>b.realizedUtility-a.realizedUtility);
}
