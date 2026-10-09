export interface FunnelState{search:number;view:number;inquiry:number;offer:number;transaction:number;}
export interface DemandSignal{conversion:number;pressure:number;trend:number;stage:string;}
const ratio=(a:number,b:number)=>b>0?a/b:0;
export function analyzeDemandFunnel(now:FunnelState,prev?:FunnelState):DemandSignal[]{
 const stages:(keyof FunnelState)[]=["search","view","inquiry","offer","transaction"];
 return stages.slice(0,-1).map((s,i)=>{const next=stages[i+1]!;const conversion=ratio(now[next],now[s]);const trend=prev?conversion-ratio(prev[next],prev[s]):0;return{conversion,pressure:conversion*Math.log1p(now[s]),trend,stage:s+"->"+next};});
}