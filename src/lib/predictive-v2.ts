/**
 * Reality Investor — Predictive Intelligence Engine v2.
 *
 * Adds the layer that makes the forecast materially more useful:
 * - market pressure from listing behaviour
 * - affordability and rate regime
 * - scenario mixture (base/upside/downside/stress)
 * - calibrated uncertainty hooks
 *
 * It never treats asking prices as transaction truth.
 */

import type { MarketObservation } from "./prediction-engine";

export interface FeatureSnapshot {
  priceM2: number;
  priceGrowthBps: number;
  inventory: number;
  newListingRateBps: number;
  priceCutRateBps: number;
  medianDom: number;
  liquidityBps: number;
  demandPressureBps: number;
  supplyPressureBps: number;
  affordabilityBps: number;
  momentumBps: number;
  volatilityBps: number;
  sourceQualityBps: number;
}

const clamp = (x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));
const mean=(x:number[])=>x.length?x.reduce((a,b)=>a+b,0)/x.length:0;

function pct(a:number,b:number){return a>0?(b/a-1)*10000:0;}

export function buildFeatureSnapshot(rows: MarketObservation[]): FeatureSnapshot {
  const r=[...rows].filter(x=>x.priceM2>0).sort((a,b)=>a.date.localeCompare(b.date));
  if(!r.length) throw new Error("At least one market observation is required.");
  const latest=r.at(-1)!;
  const previous=r.length>1?r.at(-2)!:latest;
  const changes=r.slice(1).map((x,i)=>pct(r[i]!.priceM2,x.priceM2));
  const priceGrowth=pct(previous.priceM2,latest.priceM2);
  const momentum=mean(changes.slice(-6));
  const volatility=changes.length?Math.sqrt(mean(changes.slice(-12).map(x=>(x-momentum)**2))):1800;
  const inventory=latest.listings??0;
  const priorInventory=previous.listings??inventory;
  const inventoryChange=pct(Math.max(1,priorInventory),Math.max(1,inventory));

  // These are intentionally bounded signals, not causal coefficients.
  const demandPressure=clamp(
    5000 + momentum*0.55 - inventoryChange*0.65 -
    (latest.mortgageRateBps!=null && previous.mortgageRateBps!=null
      ? (latest.mortgageRateBps-previous.mortgageRateBps)*0.7 : 0),
    -10000,10000);
  const supplyPressure=clamp(inventoryChange*0.75 + (latest.completionsGrowthBps??0)*0.35, -10000,10000);
  const affordability=clamp(
    6000 - (latest.mortgageRateBps??450)*0.65 +
    (latest.wageGrowthBps??0)*0.75 - (priceGrowth>0?priceGrowth*0.25:priceGrowth*0.1),
    -10000,10000);
  const liquidity=clamp(
    6000 - Math.max(0,(latest.daysOnMarket??60)-45)*45 -
    (latest.priceDrops??0)*20, 500, 9900);

  return {
    priceM2:latest.priceM2,
    priceGrowthBps:Math.round(priceGrowth),
    inventory,
    newListingRateBps:Math.round(inventoryChange),
    priceCutRateBps:Math.round(latest.priceDrops??0),
    medianDom:latest.daysOnMarket??60,
    liquidityBps:Math.round(liquidity),
    demandPressureBps:Math.round(demandPressure),
    supplyPressureBps:Math.round(supplyPressure),
    affordabilityBps:Math.round(affordability),
    momentumBps:Math.round(momentum),
    volatilityBps:Math.round(volatility),
    sourceQualityBps:Math.round(r.length>=24?8500:r.length>=12?7000:r.length>=6?5000:2500)
  };
}

export type ScenarioName="UPSIDE"|"BASE"|"DOWNSIDE"|"STRESS";

export interface ScenarioForecast {
  scenario:ScenarioName;
  probability:number;
  annualGrowthBps:number;
  priceM2:number;
  assumptions:string[];
}

export function scenarioMixture(
  currentPriceM2:number,
  horizonMonths:number,
  features:FeatureSnapshot,
  structuralGrowthBps:number,
):ScenarioForecast[] {
  const h=horizonMonths/12;
  const pressure=(features.demandPressureBps-features.supplyPressureBps+features.affordabilityBps)*0.035;
  const base=clamp(structuralGrowthBps+pressure,-6500,6500);
  const stress=Math.max(1800,features.volatilityBps*0.75);

  let pBase=0.50, pUp=0.20, pDown=0.22, pStress=0.08;
  if(features.demandPressureBps>4500) {pUp+=0.06;pDown-=0.04;pStress-=0.02;}
  if(features.supplyPressureBps>4500) {pDown+=0.07;pUp-=0.04;pStress-=0.03;}
  if(features.affordabilityBps<0) {pDown+=0.05;pUp-=0.02;pStress-=0.03;}
  const ps=[pUp,pBase,pDown,pStress].map(x=>clamp(x,0.02,0.85));
  const total=ps.reduce((a,b)=>a+b,0);
  pUp=ps[0]/total;pBase=ps[1]/total;pDown=ps[2]/total;pStress=ps[3]/total;

  const mk=(scenario:ScenarioName,g:number,p:number,assumptions:string[]):ScenarioForecast=>({
    scenario,probability:p,annualGrowthBps:Math.round(g),
    priceM2:Math.round(currentPriceM2*Math.exp(g*h/10000)),assumptions
  });
  return [
    mk("UPSIDE",clamp(base+stress*0.8,-7000,9000),pUp,["silná poptávka","uvolnění financování nebo pokles sazeb"]),
    mk("BASE",base,pBase,["pokračování dominantního režimu","bez extrémního makro šoku"]),
    mk("DOWNSIDE",clamp(base-stress*0.9,-9000,7000),pDown,["slabší dostupnost hypoték","vyšší nabídka nebo delší prodej"]),
    mk("STRESS",clamp(base-stress*1.8,-14000,5000),pStress,["recesní/úvěrový šok","silný růst nezaměstnanosti nebo sazeb"])
  ];
}

export function mixtureExpectedGrowth(scenarios:ScenarioForecast){
  return Math.round(scenarios.reduce((s,x)=>s+x.probability*x.annualGrowthBps,0));
}

export function probabilityAbove(scenarios:ScenarioForecast,thresholdBps:number){
  return scenarios.filter(x=>x.annualGrowthBps>=thresholdBps).reduce((s,x)=>s+x.probability,0);
}
