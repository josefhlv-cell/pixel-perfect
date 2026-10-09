/**
 * Reality Investor — Transaction Universe.
 *
 * Canonical contract for realized-property observations. This layer deliberately
 * stores event time separately from publication/availability time so historical
 * forecasts can be replayed without hindsight leakage.
 */

export type TransactionKind="SALE"|"TRANSFER"|"UNKNOWN";

export interface TransactionObservation {
  id:string;
  geography:string;
  municipality?:string;
  district?:string;
  propertyType:"APARTMENT"|"HOUSE"|"LAND"|"OTHER";
  eventTime:string;
  availableAt:string;
  price:number;
  areaM2?:number;
  priceM2?:number;
  transactionKind:TransactionKind;
  source:string;
  sourceRevision?:string;
  quality:number;
  coordinates?:{lat:number;lon:number};
}

export interface TransactionUniverse {
  observations:TransactionObservation[];
  count:number;
  coverageStart:string|null;
  coverageEnd:string|null;
  medianPriceM2:number|null;
  qualityWeightedPriceM2:number|null;
  pointInTimeReady:boolean;
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

export function normalizeTransaction(
  input:TransactionObservation,
):TransactionObservation|null{
  if(!input.id||!input.geography||!input.eventTime||!input.availableAt)return null;
  if(!Number.isFinite(input.price)||input.price<=0)return null;
  const area=input.areaM2!=null&&Number.isFinite(input.areaM2)&&input.areaM2>0?input.areaM2:undefined;
  const priceM2=input.priceM2??(area?input.price/area:undefined);
  return {
    ...input,
    areaM2:area,
    priceM2:priceM2!=null&&Number.isFinite(priceM2)&&priceM2>0?priceM2:undefined,
    quality:clamp(input.quality,0,1),
  };
}

export function buildTransactionUniverse(
  raw:TransactionObservation[],
):TransactionUniverse{
  const observations=raw.map(normalizeTransaction).filter(
    (x):x is TransactionObservation=>x!==null,
  ).sort((a,b)=>a.eventTime.localeCompare(b.eventTime));

  const prices=observations.map(x=>x.priceM2).filter(
    (x):x is number=>x!=null&&Number.isFinite(x),
  );
  const sorted=[...prices].sort((a,b)=>a-b);
  const median=sorted.length?sorted[Math.floor(sorted.length/2)]??null:null;
  const weighted=prices.length
    ?observations.reduce((s,x)=>s+(x.priceM2??0)*x.quality,0)/
      Math.max(.0001,observations.reduce((s,x)=>s+(x.priceM2?x.quality:0),0))
    :null;

  return {
    observations,
    count:observations.length,
    coverageStart:observations[0]?.eventTime??null,
    coverageEnd:observations.at(-1)?.eventTime??null,
    medianPriceM2:median,
    qualityWeightedPriceM2:weighted,
    pointInTimeReady:observations.every(x=>Date.parse(x.availableAt)>=Date.parse(x.eventTime)),
  };
}
