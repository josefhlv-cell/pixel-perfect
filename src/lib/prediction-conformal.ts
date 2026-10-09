/**
 * Reality Investor — adaptive conformal layer.
 *
 * Residuals are calibrated chronologically, never randomly shuffled.
 * For non-exchangeable time series this is a practical adaptive layer,
 * not a claim of unconditional iid coverage.
 */

export interface ConformalWindow{
  cutoff:string;
  horizonMonths:number;
  residuals:number[];
  decay:number;
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

function quantile(xs:number[],q:number){
  if(!xs.length)return 0;
  const a=[...xs].sort((x,y)=>x-y);
  const p=clamp(q,0,1)*(a.length-1),lo=Math.floor(p),hi=Math.ceil(p);
  return a[lo]!+(a[hi]!-a[lo]!)*(p-lo);
}

export function adaptiveRadius(window:ConformalWindow,coverage=.9){
  if(!window.residuals.length)return 0;
  const n=window.residuals.length;
  const weights=window.residuals.map((_,i)=>Math.pow(window.decay,n-1-i));
  const pairs=window.residuals.map((r,i)=>({r:Math.abs(r),w:weights[i]!})).sort((a,b)=>a.r-b.r);
  const total=pairs.reduce((s,x)=>s+x.w,0);
  let acc=0;
  for(const p of pairs){
    acc+=p.w;
    if(acc/total>=coverage)return p.r;
  }
  return pairs.at(-1)?.r??0;
}

export function conformalIntervalAdaptive(prediction:number,window:ConformalWindow,coverage=.9){
  const radius=adaptiveRadius(window,coverage);
  return {low:prediction-radius,high:prediction+radius,radius,coverage};
}

export function coverageAudit(rows:{actual:number;low:number;high:number}[]){
  if(!rows.length)return {coverage:0,width:0};
  return {
    coverage:rows.filter(x=>x.actual>=x.low&&x.actual<=x.high).length/rows.length,
    width:rows.reduce((s,x)=>s+x.high-x.low,0)/rows.length
  };
}
