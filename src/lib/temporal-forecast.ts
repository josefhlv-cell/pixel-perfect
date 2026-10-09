/**
 * Reality Investor — Temporal Forecast Graph.
 *
 * Represents a forecast as a chain of conditional events instead of one
 * opaque number. Each event has a horizon, probability and invalidation rule.
 */

export type EventType =
  | "RATE_TURN"
  | "DEMAND_TURN"
  | "SUPPLY_SHOCK"
  | "PRICE_ACCELERATION"
  | "PRICE_DECELERATION"
  | "LIQUIDITY_SHIFT"
  | "REGIME_CHANGE"
  | "VALUE_REVERSION";

export interface FutureEvent {
  id:string;
  type:EventType;
  horizonMonths:number;
  probability:number;
  impactBps:number;
  trigger:string;
  invalidation:string;
  confidence:number;
}

export interface TemporalForecast {
  horizonMonths:number;
  probabilityPositive:number;
  probabilityNegative:number;
  expectedGrowthBps:number;
  events:FutureEvent[];
  pathRisk:number;
  timingConfidence:number;
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

function sigmoid(x:number){return 1/(1+Math.exp(-clamp(x,-12,12)));}

export function buildTemporalForecast(input:{
  expectedGrowthBps:number;
  volatilityBps:number;
  leadingScore:number;
  turningPointProbability:number;
  rateChangeBps?:number;
  inventoryChangeBps?:number;
  liquidityBps?:number;
  horizonMonths:number;
}):TemporalForecast{
  const events:FutureEvent[]=[];
  const lead=input.leadingScore/100;
  const vol=Math.max(200,input.volatilityBps);

  if(input.rateChangeBps!=null){
    const rate=input.rateChangeBps;
    events.push({
      id:"rate-turn",
      type:"RATE_TURN",
      horizonMonths:1,
      probability:clamp(sigmoid(-rate/220),0.03,0.95),
      impactBps:Math.round(-rate*1.4),
      trigger:rate<0?"pokračující pokles sazeb":"zastavení/růst sazeb",
      invalidation:"sazby se vrátí opačným směrem po několika obdobích",
      confidence:0.68
    });
  }

  if(input.inventoryChangeBps!=null){
    const inv=input.inventoryChangeBps;
    events.push({
      id:"supply-turn",
      type:"SUPPLY_SHOCK",
      horizonMonths:2,
      probability:clamp(sigmoid(Math.abs(inv)/900)*(inv>0?0.72:0.45),0.03,0.90),
      impactBps:Math.round(-inv*0.8),
      trigger:inv>0?"zrychlení růstu nabídky":"další úbytek nabídky",
      invalidation:"tempo inventory se vrátí k dlouhodobému průměru",
      confidence:0.62
    });
  }

  if(lead>0.15){
    events.push({
      id:"acceleration",
      type:"PRICE_ACCELERATION",
      horizonMonths:Math.max(1,Math.min(6,input.horizonMonths)),
      probability:clamp(0.5+lead*0.35,0.05,0.92),
      impactBps:Math.round(Math.max(0,input.expectedGrowthBps)*0.45),
      trigger:"vedoucí indikátory zůstanou ve směru růstu",
      invalidation:"poptávka nebo financování se obrátí",
      confidence:0.60
    });
  }

  if(lead<-0.15){
    events.push({
      id:"deceleration",
      type:"PRICE_DECELERATION",
      horizonMonths:Math.max(1,Math.min(6,input.horizonMonths)),
      probability:clamp(0.5+Math.abs(lead)*0.35,0.05,0.92),
      impactBps:-Math.round(Math.abs(input.expectedGrowthBps)*0.45+vol*0.08),
      trigger:"negativní vedoucí indikátory přetrvají",
      invalidation:"zlepší se dostupnost financování nebo poptávka",
      confidence:0.60
    });
  }

  if(input.turningPointProbability>0.35){
    events.push({
      id:"regime-turn",
      type:"REGIME_CHANGE",
      horizonMonths:Math.max(1,Math.min(9,input.horizonMonths)),
      probability:clamp(input.turningPointProbability,0.05,0.90),
      impactBps:Math.round(vol*0.25),
      trigger:"většina vedoucích indikátorů změní směr",
      invalidation:"signály se vrátí do původního režimu",
      confidence:0.52
    });
  }

  const positive=Math.min(1,events.filter(e=>e.impactBps>0).reduce((s,e)=>s+e.probability*e.confidence,0));
  const negative=Math.min(1,events.filter(e=>e.impactBps<0).reduce((s,e)=>s+e.probability*e.confidence,0));
  const probabilityPositive=clamp(0.5+positive*0.45-negative*0.20,0.02,0.98);
  const probabilityNegative=clamp(1-probabilityPositive,0.02,0.98);

  return {
    horizonMonths:input.horizonMonths,
    probabilityPositive,
    probabilityNegative,
    expectedGrowthBps:Math.round(input.expectedGrowthBps),
    events:events.sort((a,b)=>a.horizonMonths-b.horizonMonths),
    pathRisk:clamp((vol/5000)*(0.55+0.45*(1-Math.abs(lead))),0.02,0.95),
    timingConfidence:clamp(0.45+events.length*0.07-vol/20000,0.05,0.90)
  };
}

export interface DecisionWindow {
  action:"BUY_NOW"|"NEGOTIATE"|"WAIT"|"AVOID"|"WATCH";
  urgency:number;
  reason:string;
}

export function decisionWindow(x:{
  futureEdge:number;
  probabilityPositive:number;
  liquidity:number;
  timingConfidence:number;
  expectedNearTermGrowthBps:number;
  negotiationPotentialBps:number;
}):DecisionWindow{
  if(x.futureEdge<35)return {action:"AVOID",urgency:0.85,reason:"Riziko a očekávaný výsledek jsou nepříznivé."};
  if(x.futureEdge>=82&&x.probabilityPositive>=0.68&&x.liquidity>=0.65)
    return {action:"BUY_NOW",urgency:clamp(0.65+x.futureEdge/300,0,1),reason:"Silná asymetrie ve prospěch investora a dostatečná likvidita."};
  if(x.futureEdge>=68&&x.negotiationPotentialBps>=500)
    return {action:"NEGOTIATE",urgency:0.72,reason:"Hodnota je zajímavá, ale největší edge vzniká vyjednáním ceny."};
  if(x.expectedNearTermGrowthBps<-700&&x.timingConfidence>0.55)
    return {action:"WAIT",urgency:0.62,reason:"Krátkodobý trend vytváří riziko, že nákup bude předčasný."};
  return {action:"WATCH",urgency:0.40,reason:"Signál je zajímavý, ale potřebuje potvrzení dalšími daty."};
}
