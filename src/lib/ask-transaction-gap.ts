/**
 * Reality Investor — Ask/Transaction Gap Engine.
 *
 * Separates seller asking dynamics from realized transaction dynamics.
 * A widening gap is treated as a negotiation/liquidity signal, never as
 * direct proof of causal price pressure.
 */

export interface PriceLayerObservation {
  period:string;
  askingIndex:number;
  realizedIndex:number;
  sourceQuality:number;
  availableAt:string;
}

export interface AskTransactionGap {
  period:string;
  gap:number;
  gapChange:number;
  direction:"NEGOTIATION_PRESSURE"|"SELLER_POWER"|"BALANCED";
  reliability:number;
}

export interface AskTransactionGapReport {
  latest:AskTransactionGap|null;
  series:AskTransactionGap[];
  widening:boolean;
  pressure:number;
  nextBestObservation:string;
  calibrationStatus:"STRUCTURAL_UNCALIBRATED"|"EMPIRICALLY_CALIBRATED";
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

export function askTransactionGap(
  observations:PriceLayerObservation[],
):AskTransactionGapReport{
  const ordered=[...observations].sort((a,b)=>a.period.localeCompare(b.period));
  const series:AskTransactionGap[]=[];
  for(let i=0;i<ordered.length;i++){
    const o=ordered[i];
    const prev=ordered[i-1];
    const gap=o.askingIndex-o.realizedIndex;
    const prevGap=prev?prev.askingIndex-prev.realizedIndex:gap;
    const change=gap-prevGap;
    const direction=change>.5
      ?"NEGOTIATION_PRESSURE"
      :change<-.5
        ?"SELLER_POWER"
        :"BALANCED";
    series.push({
      period:o.period,
      gap,
      gapChange:change,
      direction,
      reliability:clamp(o.sourceQuality,0,1),
    });
  }
  const latest=series.at(-1)??null;
  const widening=(latest?.gapChange??0)>.5;
  const pressure=clamp(Math.abs(latest?.gapChange??0)/10,0,1);
  return {
    latest,
    series,
    widening,
    pressure,
    nextBestObservation:widening
      ?"realized transaction prices + transaction volume"
      :"asking-to-realized gap at the next release",
    calibrationStatus:"STRUCTURAL_UNCALIBRATED",
  };
}
