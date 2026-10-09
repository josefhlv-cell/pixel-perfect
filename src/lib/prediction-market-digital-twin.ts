/**
 * Reality Investor — Market Digital Twin contract.
 *
 * The twin is a state-space simulation, not a crystal ball. It advances a
 * latent market state under interventions and produces distributions over
 * possible trajectories.
 */

export interface MarketTwinState{
  priceIndex:number;
  inventoryIndex:number;
  demandIndex:number;
  affordabilityIndex:number;
  liquidityIndex:number;
  creditIndex:number;
  rentIndex:number;
  constructionIndex:number;
  employmentIndex:number;
}

export interface TwinIntervention{
  name:string;
  durationMonths:number;
  delta:Partial<MarketTwinState>;
}

export interface TwinStep{
  month:number;
  state:MarketTwinState;
  eventProbabilities:Record<string,number>;
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

export function stepTwin(state:MarketTwinState,intervention:TwinIntervention,month:number):TwinStep{
  const d=intervention.delta;
  const next:{[K in keyof MarketTwinState]:number}={...state};
  for(const k of Object.keys(next) as (keyof MarketTwinState)[]){
    const shock=(d[k]??0)/(Math.max(1,intervention.durationMonths));
    next[k]=clamp(next[k]+shock,-10000,10000);
  }
  next.demandIndex=clamp(next.demandIndex+0.12*next.affordabilityIndex+0.06*next.creditIndex-0.05*next.inventoryIndex,-10000,10000);
  next.liquidityIndex=clamp(next.liquidityIndex-0.08*next.inventoryIndex+0.05*next.demandIndex,-10000,10000);
  next.priceIndex=clamp(next.priceIndex+0.07*next.demandIndex-0.05*next.inventoryIndex+0.03*next.rentIndex,-10000,10000);
  next.inventoryIndex=clamp(next.inventoryIndex+0.04*next.constructionIndex-0.03*next.demandIndex,-10000,10000);
  next.affordabilityIndex=clamp(next.affordabilityIndex-0.08*next.priceIndex+0.05*next.employmentIndex,-10000,10000);
  return {
    month,
    state:next,
    eventProbabilities:{
      PRICE_ACCELERATION:clamp(0.5+next.demandIndex/20000,0.01,0.99),
      LIQUIDITY_STRESS:clamp(0.5+next.inventoryIndex/20000-next.demandIndex/25000,0.01,0.99),
      REGIME_CHANGE:clamp(0.2+Math.abs(next.creditIndex)/30000,0.01,0.95)
    }
  };
}

export function simulateTwin(initial:MarketTwinState,intervention:TwinIntervention,horizonMonths=24):TwinStep[]{
  const out:TwinStep[]=[];
  let state=initial;
  for(let m=1;m<=Math.min(120,horizonMonths);m++){
    const step=stepTwin(state,intervention,m);
    out.push(step);
    state=step.state;
  }
  return out;
}
