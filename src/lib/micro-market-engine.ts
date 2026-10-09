export interface PropertyPoint{lat:number;lon:number;priceM2:number;quality:number;submarket?:string;}
export interface MicroMarket{id:string;center:{lat:number;lon:number};count:number;medianPriceM2:number;dispersion:number;confidence:number;}
const distance=(a:PropertyPoint,b:PropertyPoint)=>Math.hypot(a.lat-b.lat,(a.lon-b.lon)*Math.cos(a.lat*Math.PI/180))*111;
export function buildMicroMarkets(points:PropertyPoint[],radiusKm=.75):MicroMarket[]{const remaining=[...points],out:MicroMarket[]=[];let id=1;
while(remaining.length){const seed=remaining.shift()!,members=[seed,...remaining.filter(p=>distance(seed,p)<=radiusKm)];for(const p of members.slice(1)){const i=remaining.indexOf(p);if(i>=0)remaining.splice(i,1);}
const prices=members.map(p=>p.priceM2).sort((a,b)=>a-b),med=prices[Math.floor((prices.length-1)/2)]!,mad=prices.map(x=>Math.abs(x-med)).sort((a,b)=>a-b)[Math.floor((prices.length-1)/2)]??0,q=members.reduce((s,p)=>s+p.quality,0)/members.length;
out.push({id:"MICRO_"+id++,center:{lat:seed.lat,lon:seed.lon},count:members.length,medianPriceM2:med,dispersion:mad,confidence:Math.min(.95,q*Math.min(1,members.length/20))});}return out;}