/**
 * Reality Investor — Truth Layer.
 *
 * Separates observed market truth from proxy signals. A forecast can consume
 * all layers, but transaction observations outrank asking prices for realized
 * price validation.
 */

export type TruthLevel=
  |"TRANSACTION"
  |"OFFICIAL_INDEX"
  |"ASKING"
  |"RENT"
  |"BEHAVIORAL"
  |"MACRO"
  |"SENTIMENT";

export interface TruthObservation {
  id:string;
  geography:string;
  period:string;
  metric:"PRICE_M2"|"PRICE_INDEX"|"RENT_M2"|"VOLUME"|"DOM";
  value:number;
  truthLevel:TruthLevel;
  eventTime:string;
  availableAt:string;
  source:string;
  reliability:number;
}

export interface TruthLayer {
  observations:TruthObservation[];
  transactionCoverage:number;
  realizedPrice:number|null;
  askingPrice:number|null;
  askingRealizedGap:number|null;
  dominantTruth:"TRANSACTION"|"OFFICIAL_INDEX"|"PROXY";
  validationReady:boolean;
}

const rank:Record<TruthLevel,number>={
  TRANSACTION:1,OFFICIAL_INDEX:2,ASKING:3,RENT:4,BEHAVIORAL:5,MACRO:6,SENTIMENT:7
};

export function buildTruthLayer(observations:TruthObservation[]):TruthLayer{
  const valid=observations.filter(o=>Number.isFinite(o.value)&&o.value>=0);
  const transaction=valid.filter(o=>o.truthLevel==="TRANSACTION"&&o.metric==="PRICE_M2");
  const official=valid.filter(o=>o.truthLevel==="OFFICIAL_INDEX");
  const asking=valid.filter(o=>o.truthLevel==="ASKING"&&o.metric==="PRICE_M2");
  const realized=transaction.at(-1)?.value??null;
  const ask=asking.at(-1)?.value??null;
  const coverage=Math.min(1,transaction.length/24);
  const dominant=transaction.length?"TRANSACTION":official.length?"OFFICIAL_INDEX":"PROXY";
  return {
    observations:valid.sort((a,b)=>rank[a.truthLevel]-rank[b.truthLevel]),
    transactionCoverage:coverage,
    realizedPrice:realized,
    askingPrice:ask,
    askingRealizedGap:realized!=null&&ask!=null?ask-realized:null,
    dominantTruth:dominant,
    validationReady:transaction.length>=24,
  };
}
