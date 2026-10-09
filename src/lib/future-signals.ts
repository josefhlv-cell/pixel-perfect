/**
 * Reality Investor — Future Signals Engine.
 *
 * Turns current market observations into leading-indicator signals,
 * turning-point alerts and counterfactual paths. These are hypotheses
 * that must be validated by walk-forward backtests, not claims of causality.
 */

import type { MarketObservation } from "./prediction-engine";

export type SignalDirection = "BULLISH"|"BEARISH"|"NEUTRAL";
export type TurningPoint = "EARLY_RECOVERY"|"ACCELERATION"|"PEAK_RISK"|"DECELERATION"|"BREAKDOWN"|"NONE";

export interface LeadingSignal {
  name:string;
  score:number;
  direction:SignalDirection;
  horizonMonths:number;
  reason:string;
  confidence:number;
}

export interface FuturePulse {
  leadingScore:number;
  direction:SignalDirection;
  turningPoint:TurningPoint;
  probabilityTurningPoint:number;
  signals:LeadingSignal[];
  watchItems:string[];
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));
const mean=(x:number[])=>x.length?x.reduce((a,b)=>a+b,0)/x.length:0;

function delta(a:number|undefined|null,b:number|undefined|null){
  if(a==null||b==null)return null;
  return b-a;
}
function slope(xs:number[]){
  if(xs.length<2)return 0;
  const n=xs.length,m=mean(xs);
  const xm=(n-1)/2;
  const ym=m;
  const den=xs.reduce((s,_,i)=>s+(i-xm)**2,0);
  return den?xs.reduce((s,y,i)=>s+(i-xm)*(y-ym),0)/den:0;
}
function sigmoid(x:number){return 1/(1+Math.exp(-clamp(x,-12,12)));}

export function leadingSignals(rows:MarketObservation[]):FuturePulse{
  const r=[...rows].filter(x=>x.priceM2>0).sort((a,b)=>a.date.localeCompare(b.date));
  if(r.length<4){
    return {leadingScore:0,direction:"NEUTRAL",turningPoint:"NONE",probabilityTurningPoint:0,signals:[],watchItems:["Potřebujeme alespoň několik historických období."]};
  }
  const last=r.at(-1)!;
  const prev=r.at(-2)!;
  const window=r.slice(-6);
  const priceGrowth=slope(window.map(x=>x.priceM2/Math.max(1,window[0]!.priceM2)-1));
  const inventoryGrowth=last.listings!=null&&prev.listings!=null?delta(prev.listings,last.listings)!/Math.max(1,prev.listings):0;
  const domChange=delta(prev.daysOnMarket,last.daysOnMarket);
  const rateChange=delta(prev.mortgageRateBps,last.mortgageRateBps);
  const wage=last.wageGrowthBps??0;
  const credit=last.creditGrowthBps??0;
  const supply=last.completionsGrowthBps??0;

  const signals:LeadingSignal[]=[];
  const add=(name:string,score:number,horizon:number,reason:string,confidence:number)=>{
    const s=clamp(score,-100,100);
    signals.push({name,score:s,direction:s>15?"BULLISH":s<-15?"BEARISH":"NEUTRAL",horizonMonths:horizon,reason,confidence:clamp(confidence,0.05,0.95)});
  };

  add("inventory momentum",clamp(-inventoryGrowth*220, -70,70),3,
    inventoryGrowth<0?"Nabídka se zmenšuje rychleji než dříve.":"Nabídka roste; kupující získávají více výběru.",
    0.65);
  if(domChange!=null) add("time-on-market",clamp(-domChange*1.8,-65,65),2,
    domChange<0?"Nemovitosti se začínají prodávat rychleji.":"Doba prodeje se prodlužuje.",
    0.58);
  if(rateChange!=null) add("financing impulse",clamp(-rateChange/25,-75,75),3,
    rateChange<0?"Financování se meziměsíčně uvolňuje.":"Financování se zpřísňuje.",
    0.72);
  add("income impulse",clamp(wage/35,-60,60),6,
    wage>0?"Růst příjmů zlepšuje kupní sílu.":"Slabý růst příjmů omezuje dostupnost.",
    0.55);
  add("credit impulse",clamp(credit/30,-60,60),4,
    credit>0?"Úvěrová aktivita podporuje poptávku.":"Úvěrová aktivita je slabší.",
    0.60);
  add("new-supply impulse",clamp(-supply/35,-65,65),9,
    supply>0?"Růst nové nabídky může později zmírnit cenový tlak.":"Slabá nová výstavba zvyšuje riziko strukturálního nedostatku.",
    0.62);
  add("price momentum",clamp(priceGrowth*900,-70,70),1,
    priceGrowth>0?"Ceny zrychlují.":"Cenové momentum slábne.",
    0.70);

  const weighted=signals.reduce((s,x)=>s+x.score*x.confidence,0)/Math.max(1,signals.reduce((s,x)=>s+x.confidence,0));
  const direction=weighted>15?"BULLISH":weighted<-15?"BEARISH":"NEUTRAL";

  const positive=signals.filter(x=>x.score>15).length;
  const negative=signals.filter(x=>x.score<-15).length;
  let turningPoint:TurningPoint="NONE";
  let probabilityTurningPoint=0;

  if(priceGrowth<0&&positive>=3){turningPoint="EARLY_RECOVERY";probabilityTurningPoint=sigmoid((positive-negative)*0.8);}
  else if(priceGrowth>0&&positive>=5){turningPoint="ACCELERATION";probabilityTurningPoint=sigmoid((positive-negative)*0.7);}
  else if(priceGrowth>0&&negative>=3){turningPoint="PEAK_RISK";probabilityTurningPoint=sigmoid((negative-positive)*0.8);}
  else if(priceGrowth<0&&negative>=3){turningPoint="BREAKDOWN";probabilityTurningPoint=sigmoid((negative-positive)*0.8);}
  else if(Math.abs(priceGrowth)<0.001&&negative>positive){turningPoint="DECELERATION";probabilityTurningPoint=sigmoid((negative-positive)*0.7);}

  const watchItems:string[]=[];
  if(rateChange!=null) watchItems.push("Další pohyb hypotečních sazeb.");
  if(inventoryGrowth!==0) watchItems.push("Tempo změny zásoby aktivních nabídek.");
  if(supply!==0) watchItems.push("Nová výstavba a dokončování projektů.");
  if(credit!==0) watchItems.push("Úvěrová aktivita domácností.");
  if(domChange!=null) watchItems.push("Doba, po kterou nabídky zůstávají aktivní.");

  return {
    leadingScore:Math.round(weighted),
    direction,
    turningPoint,
    probabilityTurningPoint:clamp(probabilityTurningPoint,0,0.97),
    signals:signals.sort((a,b)=>Math.abs(b.score*b.confidence)-Math.abs(a.score*a.confidence)),
    watchItems
  };
}

export interface CounterfactualPath{
  name:string;
  probabilityShift:number;
  annualGrowthBps:number;
  explanation:string;
}

export function counterfactualPaths(baseGrowthBps:number,rows:MarketObservation[]):CounterfactualPath[]{
  const r=[...rows].sort((a,b)=>a.date.localeCompare(b.date));
  const last=r.at(-1);
  const prev=r.at(-2);
  const rate=last&&prev?delta(prev.mortgageRateBps,last.mortgageRateBps)??0:0;
  const inventory=last&&prev&&last.listings!=null&&prev.listings!=null
    ?(last.listings-prev.listings)/Math.max(1,prev.listings):0;
  return [
    {name:"RATE_CUT",probabilityShift:clamp(-rate/500,-0.15,0.15),annualGrowthBps:Math.round(baseGrowthBps+Math.max(0,-rate)*1.8),explanation:"Modelový scénář rychlejšího uvolnění financování."},
    {name:"SUPPLY_SURGE",probabilityShift:clamp(inventory*0.4,-0.10,0.10),annualGrowthBps:Math.round(baseGrowthBps-inventory*800),explanation:"Modelový scénář výrazného růstu nabídky."},
    {name:"CREDIT_STRESS",probabilityShift:clamp(rate/500,-0.05,0.18),annualGrowthBps:Math.round(baseGrowthBps-Math.max(0,rate)*2.2-900),explanation:"Modelový úvěrový stres."},
    {name:"SOFT_LANDING",probabilityShift:0,annualGrowthBps:Math.round(baseGrowthBps),explanation:"Pokračování současného režimu bez velkého šoku."}
  ];
}
