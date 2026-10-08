/**
 * Future Twin Shock Matrix
 *
 * Generates a compact grid of plausible interacting shocks for the Market Twin.
 * It is a scenario design tool; it does not assign real-world probabilities.
 */
import {runFutureMarketTwin,type FutureMarketTwinInput,type TwinShock} from "./future-market-twin";

export interface ShockAxis{
 node:FutureMarketTwinInput["shocks"][number]["node"];
 deltas:number[];
 label:string;
}
export interface ShockMatrixCase{
 id:string;
 shocks:TwinShock[];
 priceImpact:number;
 uncertainty:number;
}
export function buildFutureTwinShockMatrix(
 base:Omit<FutureMarketTwinInput,"shocks">,
 axes:ShockAxis[],
):ShockMatrixCase[]{
 const cases:ShockMatrixCase[]=[];
 const walk=(i:number,current:TwinShock[])=>{
  if(i===axes.length){
   const twin=runFutureMarketTwin({...base,shocks:current});
   cases.push({
    id:current.map(x=>`${x.node}:${x.delta}`).join("|"),
    shocks:[...current],priceImpact:twin.finalState.find(x=>x.node==="TRANSACTION_PRICE")?.value??0,
    uncertainty:twin.uncertainty
   });
   return;
  }
  const axis=axes[i]!;
  for(const delta of axis.deltas)walk(i+1,[...current,{node:axis.node,delta,label:axis.label}]);
 };
 walk(0,[]);
 return cases;
}
