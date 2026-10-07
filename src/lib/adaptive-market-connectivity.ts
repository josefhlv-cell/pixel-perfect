/**
 * Adaptive Market Connectivity — decides whether neighboring markets should
 * influence a forecast. Connectivity is useful only when it wins OOS.
 *
 * Inspired by current housing-forecast research showing that strong/dense
 * inter-market links can improve short-horizon forecasts while weak/sparse
 * links can make univariate models superior.
 */
export interface ConnectivityPair{from:string;to:string;lagMonths:number;strength:number;stability:number;}
export interface ConnectivityEvaluation{
  density:number;
  meanStrength:number;
  effectiveStrength:number;
  recommendedMode:"CONNECTED"|"LOCAL"|"ENSEMBLE";
  reason:string;
}
export interface ConnectivityBacktest{localLoss:number;connectedLoss:number;sampleSize:number;}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

export function evaluateMarketConnectivity(
  pairs:ConnectivityPair[],
  backtest?:ConnectivityBacktest,
):ConnectivityEvaluation{
  const valid=pairs.filter(x=>x.strength>0&&x.stability>0);
  const density=clamp(valid.length/Math.max(1,pairs.length),0,1);
  const meanStrength=valid.length
    ?valid.reduce((s,x)=>s+Math.abs(x.strength),0)/valid.length:0;
  const effectiveStrength=clamp(meanStrength*density*
    (valid.length?valid.reduce((s,x)=>s+x.stability,0)/valid.length:0),0,1);

  if(!backtest){
    return {
      density,meanStrength,effectiveStrength,
      recommendedMode:effectiveStrength>.45?"CONNECTED":"ENSEMBLE",
      reason:"No OOS comparison yet; connectivity is provisional.",
    };
  }

  const gain=backtest.localLoss>0
    ?(backtest.localLoss-backtest.connectedLoss)/backtest.localLoss:0;

  const recommendedMode=
    backtest.sampleSize<20
      ?"ENSEMBLE"
      :gain>.03&&effectiveStrength>.35
        ?"CONNECTED"
        :gain<-.03
          ?"LOCAL"
          :"ENSEMBLE";

  return {
    density,meanStrength,effectiveStrength,recommendedMode,
    reason:gain>.03
      ?"Connected model wins OOS."
      :gain<-.03
        ?"Local model wins OOS; connectivity is rejected."
        :"OOS evidence is inconclusive; retain an ensemble.",
  };
}
