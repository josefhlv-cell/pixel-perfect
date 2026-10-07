/**
 * Reality Investor — correlated scenario Monte Carlo.
 *
 * Uses an explicit correlation matrix so macro shocks are not sampled as
 * independent fantasy variables. Positive-definiteness is the responsibility
 * of the calibration/training pipeline; this runtime layer uses a stable
 * triangular factor supplied by the caller.
 */

export interface CorrelatedShock{
  name:string;
  mean:number;
  std:number;
}

export interface MonteCarloPath{
  shocks:Record<string,number>;
  outcome:number;
}

export function simulateCorrelated(
  shocks:CorrelatedShock[],
  lowerTriangular:number[][],
  paths=5000,
  seed=917331,
  response:(values:Record<string,number>)=>number=(v)=>Object.values(v).reduce((a,b)=>a+b,0)
):MonteCarloPath[]{
  const rng=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return ((seed>>>0)+1)/4294967297};
  const normal=()=>{
    const u=Math.max(1e-12,rng()),v=Math.max(1e-12,rng());
    return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
  };
  const out:MonteCarloPath[]=[];
  for(let p=0;p<Math.max(100,Math.min(100000,paths));p++){
    const z=shocks.map(()=>normal());
    const values:Record<string,number>={};
    shocks.forEach((s,i)=>{
      let correlated=0;
      for(let j=0;j<=i;j++) correlated+=(lowerTriangular[i]?.[j]??0)*(z[j]??0);
      values[s.name]=s.mean+s.std*correlated;
    });
    out.push({shocks:values,outcome:response(values)});
  }
  return out;
}
