export interface TransactionObservation{propertyId:string;geoId:string;eventTime:string;availableAt:string;price:number;area:number;quality:number;}
export interface ReplayCut{cutoff:string;horizonMonths:number;train:TransactionObservation[];outcomes:TransactionObservation[];}
export function canonicalTransactions(rows:TransactionObservation[]):TransactionObservation[]{return rows.filter(x=>x.price>0&&x.area>0&&x.quality>=.3).sort((a,b)=>Date.parse(a.eventTime)-Date.parse(b.eventTime));}
export function replayAt(rows:TransactionObservation[],cutoff:string,horizonMonths:number):ReplayCut{
 const t=Date.parse(cutoff),end=t+horizonMonths*30.44*86400000;
 return {cutoff,horizonMonths,train:canonicalTransactions(rows).filter(x=>Date.parse(x.availableAt)<=t&&Date.parse(x.eventTime)<=t),
 outcomes:canonicalTransactions(rows).filter(x=>Date.parse(x.eventTime)>t&&Date.parse(x.eventTime)<=end&&Date.parse(x.availableAt)<=Date.parse(x.eventTime))};
}