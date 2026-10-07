/**
 * Reality Investor — Market Pressure Observatory.
 *
 * Converts leading market indicators into transparent pressure impulses.
 * This is not a causal estimate; it is a feature layer for regime detection,
 * early-warning and future trajectory models.
 */

export type PressureDirection="BULLISH"|"BEARISH"|"NEUTRAL";

export interface PressureSignal {
  id:string;
  family:"CREDIT"|"AFFORDABILITY"|"INVENTORY"|"LIQUIDITY"|"DEMAND"|"SUPPLY"|"RENT"|"MOMENTUM";
  value:number;
  direction:PressureDirection;
  leadMonths:number;
  reliability:number;
  explanation:string;
}

export interface MarketPressureReport {
  composite:number;
  confidence:number;
  signals:PressureSignal[];
  bullishPressure:number;
  bearishPressure:number;
  conflict:number;
  earlyWarning:string|null;
  nextObservation:string;
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

export interface MarketPressureInput {
  priceGrowth:number;
  rentGrowth:number;
  inventoryGrowth:number;
  domGrowth:number;
  mortgageRateChange:number;
  creditGrowth:number;
  liquidity:number;
  supplyGrowth:number;
  wageGrowth:number;
  unemploymentChange:number;
  priceDropGrowth:number;
  transactionGrowth:number;
}

export function marketPressure(i:MarketPressureInput):MarketPressureReport{
  const signals:PressureSignal[]=[
    {
      id:"credit-impulse",family:"CREDIT",value:i.creditGrowth,
      direction:i.creditGrowth>.02?"BULLISH":i.creditGrowth<-.02?"BEARISH":"NEUTRAL",
      leadMonths:3,reliability:.85,
      explanation:"Credit acceleration can precede changes in housing demand."
    },
    {
      id:"financing-shock",family:"AFFORDABILITY",value:-i.mortgageRateChange,
      direction:i.mortgageRateChange<-.005?"BULLISH":i.mortgageRateChange>.005?"BEARISH":"NEUTRAL",
      leadMonths:2,reliability:.90,
      explanation:"Falling financing costs improve affordability; rising costs reduce it."
    },
    {
      id:"inventory-impulse",family:"INVENTORY",value:-i.inventoryGrowth,
      direction:i.inventoryGrowth<-.03?"BULLISH":i.inventoryGrowth>.05?"BEARISH":"NEUTRAL",
      leadMonths:3,reliability:.82,
      explanation:"Inventory contraction can signal tightening supply; expansion can precede weaker pricing power."
    },
    {
      id:"dom-impulse",family:"LIQUIDITY",value:-i.domGrowth,
      direction:i.domGrowth<-.05?"BULLISH":i.domGrowth>.10?"BEARISH":"NEUTRAL",
      leadMonths:2,reliability:.78,
      explanation:"Time-on-market is a leading liquidity and negotiation signal."
    },
    {
      id:"rent-pressure",family:"RENT",value:i.rentGrowth,
      direction:i.rentGrowth>.04?"BULLISH":i.rentGrowth<0?"BEARISH":"NEUTRAL",
      leadMonths:6,reliability:.72,
      explanation:"Rent resilience supports investor demand and income expectations."
    },
    {
      id:"supply-pipeline",family:"SUPPLY",value:-i.supplyGrowth,
      direction:i.supplyGrowth>.05?"BEARISH":i.supplyGrowth<-.03?"BULLISH":"NEUTRAL",
      leadMonths:12,reliability:.70,
      explanation:"New supply affects future inventory with a longer lag."
    },
    {
      id:"income-pressure",family:"DEMAND",value:i.wageGrowth-i.unemploymentChange,
      direction:i.wageGrowth>.03&&i.unemploymentChange<=0?"BULLISH":
        i.wageGrowth<0||i.unemploymentChange>.01?"BEARISH":"NEUTRAL",
      leadMonths:6,reliability:.75,
      explanation:"Income and employment jointly influence effective housing demand."
    },
    {
      id:"transaction-impulse",family:"MOMENTUM",value:i.transactionGrowth,
      direction:i.transactionGrowth>.05?"BULLISH":i.transactionGrowth<-.05?"BEARISH":"NEUTRAL",
      leadMonths:2,reliability:.86,
      explanation:"Transaction activity can reveal demand before asking prices fully adjust."
    },
    {
      id:"price-drop-pressure",family:"MOMENTUM",value:-i.priceDropGrowth,
      direction:i.priceDropGrowth>.10?"BEARISH":i.priceDropGrowth<-.05?"BULLISH":"NEUTRAL",
      leadMonths:1,reliability:.68,
      explanation:"Increasing price reductions can reveal weakening seller power."
    },
  ];

  const bullish=signals.filter(s=>s.direction==="BULLISH");
  const bearish=signals.filter(s=>s.direction==="BEARISH");
  const bullWeight=bullish.reduce((s,x)=>s+x.reliability*Math.abs(x.value),0);
  const bearWeight=bearish.reduce((s,x)=>s+x.reliability*Math.abs(x.value),0);
  const total=bullWeight+bearWeight;
  const composite=total?clamp((bullWeight-bearWeight)/total,-1,1):0;
  const conflict=total?clamp(Math.min(bullWeight,bearWeight)/Math.max(bullWeight,bearWeight),0,1):0;
  const confidence=clamp(.35+signals.filter(s=>s.direction!=="NEUTRAL").length*.06-conflict*.18,.15,.92);

  const earlyWarning=
    bearish.length>=4&&composite<-.20
      ?"BROAD_DOWNSIDE_PRESSURE"
      :bullish.length>=4&&composite>.20
        ?"BROAD_UPSIDE_PRESSURE"
        :conflict>.45
          ?"EVIDENCE_CONFLICT"
          :null;

  const nextObservation=[...signals].sort((a,b)=>
    (b.reliability*Math.abs(b.value))/(Math.max(1,b.leadMonths))-
    (a.reliability*Math.abs(a.value))/(Math.max(1,a.leadMonths))
  )[0];

  return {
    composite,
    confidence,
    signals,
    bullishPressure:bullWeight,
    bearishPressure:bearWeight,
    conflict,
    earlyWarning,
    nextObservation:nextObservation?.id??"transactions",
  };
}
