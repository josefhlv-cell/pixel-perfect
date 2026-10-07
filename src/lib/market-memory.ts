/**
 * Market Memory — historical analogue search.
 * Pure TypeScript, deterministic and auditable.
 */

export interface MarketStateVector{
  priceMomentum:number;
  inventoryMomentum:number;
  rateMomentum:number;
  creditMomentum:number;
  rentMomentum:number;
  employmentMomentum:number;
  supplyMomentum:number;
  liquidity:number;
}

export interface HistoricalAnalogue{
  date:string;
  similarity:number;
  next12mGrowthBps?:number|null;
  next24mGrowthBps?:number|null;
  regime:string;
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

function distance(a:MarketStateVector,b:MarketStateVector){
  const keys=(Object.keys(a) as (keyof MarketStateVector)[]);
  const ds=keys.map(k=>{
    const scale=Math.max(100,Math.abs(a[k]),Math.abs(b[k]));
    return ((a[k]-b[k])/scale)**2;
  });
  return Math.sqrt(ds.reduce((s,x)=>s+x,0)/keys.length);
}

export function findHistoricalAnalogues(current:MarketStateVector,history:(MarketStateVector&{date:string;next12mGrowthBps?:number|null;next24mGrowthBps?:number|null;regime:string})[],limit=12):HistoricalAnalogue[]{
  return history.map(h=>({
    date:h.date,
    similarity:clamp(Math.exp(-distance(current,h)),0,1),
    next12mGrowthBps:h.next12mGrowthBps,
    next24mGrowthBps:h.next24mGrowthBps,
    regime:h.regime
  })).sort((a,b)=>b.similarity-a.similarity).slice(0,limit);
}

export function analogueOutcome(analogues:HistoricalAnalogue[]){
  const usable=analogues.filter(x=>x.next12mGrowthBps!=null&&x.similarity>0.35);
  if(!usable.length)return {expected12mGrowthBps:0,probabilityPositive:0.5,evidenceStrength:0};
  const w=usable.map(x=>x.similarity);
  const total=w.reduce((a,b)=>a+b,0);
  const expected=usable.reduce((s,x,i)=>s+(x.next12mGrowthBps??0)*w[i]!,0)/total;
  const positive=usable.reduce((s,x,i)=>s+((x.next12mGrowthBps??0)>0?w[i]!:0),0)/total;
  return {expected12mGrowthBps:Math.round(expected),probabilityPositive:clamp(positive,0.02,0.98),evidenceStrength:clamp(total/4,0,1)};
}
