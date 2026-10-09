export interface PropertyTwinInput{price:number;fairValue:number;rent:number;rentGrowth:number;marketGrowth:number;liquidity:number;confidence:number;modelRisk:number;condition:number;locationScore:number;}
export interface FuturePath{horizonMonths:number;expectedValue:number;rent:number;liquidity:number;probability:number;regime:string;}
export interface PropertyFutureTwin{base:FuturePath;paths:FuturePath[];upsideProbability:number;downsideProbability:number;breakEvenMonths:number;fragility:number;futureEdge:number;}
const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));
export function buildPropertyFutureTwin(x:PropertyTwinInput):PropertyFutureTwin{
 const specs=[["BASE",x.marketGrowth,x.rentGrowth,x.liquidity,.40],["ACCELERATION",x.marketGrowth+.05,x.rentGrowth+.02,Math.min(1,x.liquidity+.12),.18],["DECELERATION",x.marketGrowth-.04,x.rentGrowth-.01,Math.max(0,x.liquidity-.08),.18],["CORRECTION",x.marketGrowth-.10,x.rentGrowth-.03,Math.max(0,x.liquidity-.25),.14],["LIQUIDITY_STRESS",x.marketGrowth-.15,x.rentGrowth-.05,Math.max(0,x.liquidity-.40),.10]] as const;
 const paths=specs.map(([regime,g,r,l,p])=>{const value=x.price*Math.pow(1+g,2)+x.rent*24;return{horizonMonths:24,expectedValue:value,rent:x.rent*Math.pow(1+r,2),liquidity:l,probability:p,regime};});
 const upsideProbability=paths.filter(p=>p.expectedValue>x.price).reduce((s,p)=>s+p.probability,0);
 const downsideProbability=paths.filter(p=>p.expectedValue<x.price).reduce((s,p)=>s+p.probability,0);
 const breakEvenMonths=x.fairValue<=x.price?0:Math.ceil(Math.log(x.fairValue/x.price)/Math.log(1+Math.max(-.02,x.marketGrowth)/12));
 const fragility=clamp(downsideProbability*(1-x.liquidity)+x.modelRisk*.5+(1-x.confidence)*.35,0,1);
 return{base:paths[0]!,paths,upsideProbability,downsideProbability,breakEvenMonths,fragility,futureEdge:clamp((x.fairValue/x.price-1)*.45+x.marketGrowth*.35+x.rentGrowth*.15+x.liquidity*.05, -1,1)};
}