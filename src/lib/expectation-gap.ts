/**
 * Reality Investor — Expectation Gap.
 *
 * Measures disagreement between forward-looking market expectations and
 * realized/transaction conditions. It is a behavioral signal, not a causal
 * estimator.
 */

export interface ExpectationObservation {
  period:string;
  askingGrowth:number;
  searchDemandGrowth:number;
  sentiment:number;
  transactionGrowth:number;
  rentGrowth:number;
  liquidity:number;
  sourceQuality:number;
}

export interface ExpectationGap {
  period:string;
  expectation:number;
  reality:number;
  gap:number;
  regime:"EXPECTATION_AHEAD"|"REALITY_AHEAD"|"ALIGNED"|"CONFLICT";
  reliability:number;
}

export interface ExpectationGapReport {
  latest:ExpectationGap|null;
  series:ExpectationGap[];
  conflict:number;
  reversalRisk:number;
  nextBestObservation:string;
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

export function expectationGap(
  rows:ExpectationObservation[],
):ExpectationGapReport{
  const series=rows.map(r=>{
    const expectation=.45*r.askingGrowth+.30*r.searchDemandGrowth+.25*r.sentiment;
    const reality=.55*r.transactionGrowth+.30*r.rentGrowth+.15*r.liquidity;
    const gap=expectation-reality;
    const regime=Math.abs(gap)<.02
      ?"ALIGNED"
      :gap>.08
        ?"EXPECTATION_AHEAD"
        :gap<-.08
          ?"REALITY_AHEAD"
          :"CONFLICT";
    return {
      period:r.period,
      expectation,
      reality,
      gap,
      regime,
      reliability:clamp(r.sourceQuality,0,1),
    };
  });
  const latest=series.at(-1)??null;
  const conflict=clamp(Math.abs(latest?.gap??0)/.20,0,1);
  const reversalRisk=clamp(
    (latest?.regime==="EXPECTATION_AHEAD"?conflict:0)+
    (latest?.regime==="CONFLICT"?conflict*.5:0),0,1
  );
  return {
    latest,
    series,
    conflict,
    reversalRisk,
    nextBestObservation:latest?.regime==="EXPECTATION_AHEAD"
      ?"realized transaction volume + price reductions"
      :"transaction prices + mortgage approvals",
  };
}
