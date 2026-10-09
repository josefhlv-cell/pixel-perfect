/**
 * Reality Investor — Transaction Benchmark.
 *
 * Builds realized growth outcomes from the transaction universe for forecast
 * evaluation. It never substitutes asking prices for missing transaction data.
 */

import type {TransactionObservation} from "./transaction-universe";

export interface TransactionBenchmarkOutcome {
  geography:string;
  periodStart:string;
  periodEnd:string;
  horizonMonths:number;
  startPriceM2:number;
  endPriceM2:number;
  realizedGrowth:number;
  observationsStart:number;
  observationsEnd:number;
  quality:number;
}

function median(xs:number[]):number|null{
  if(!xs.length)return null;
  const s=[...xs].sort((a,b)=>a-b);
  return s[Math.floor((s.length-1)/2)]??null;
}

function monthsBetween(a:string,b:string):number{
  const da=new Date(a); const db=new Date(b);
  return (db.getUTCFullYear()-da.getUTCFullYear())*12+
    db.getUTCMonth()-da.getUTCMonth();
}

export function buildTransactionBenchmark(
  observations:TransactionObservation[],
  geography:string,
  horizonMonths=12,
  cutoff?:string,
):TransactionBenchmarkOutcome[]{
  const usable=observations.filter(x=>
    x.geography===geography &&
    x.priceM2!=null &&
    (!cutoff || Date.parse(x.availableAt)<=Date.parse(cutoff))
  );

  const periods=[...new Set(usable.map(x=>x.eventTime.slice(0,7)))].sort();
  const outcomes:TransactionBenchmarkOutcome[]=[];

  for(const startPeriod of periods){
    const startDate=new Date(startPeriod+"-01T00:00:00Z");
    const endDate=new Date(startDate);
    endDate.setUTCMonth(endDate.getUTCMonth()+horizonMonths);
    const endKey=endDate.toISOString().slice(0,7);

    const start=usable.filter(x=>x.eventTime.slice(0,7)===startPeriod);
    const end=usable.filter(x=>x.eventTime.slice(0,7)===endKey);
    const startMedian=median(start.map(x=>x.priceM2!));
    const endMedian=median(end.map(x=>x.priceM2!));
    if(startMedian==null||endMedian==null||startMedian<=0)continue;

    const qualityValues=[...start,...end].map(x=>x.quality);
    outcomes.push({
      geography,
      periodStart:startPeriod,
      periodEnd:endKey,
      horizonMonths:monthsBetween(startPeriod,endKey),
      startPriceM2:startMedian,
      endPriceM2:endMedian,
      realizedGrowth:endMedian/startMedian-1,
      observationsStart:start.length,
      observationsEnd:end.length,
      quality:qualityValues.reduce((a,b)=>a+b,0)/Math.max(1,qualityValues.length),
    });
  }

  return outcomes;
}
