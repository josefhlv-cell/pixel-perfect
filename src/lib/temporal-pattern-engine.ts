/**
 * Temporal Pattern Engine
 * Finds repeated chronological relationships between observed market events.
 * Patterns are research candidates only until they survive point-in-time replay.
 */
export interface TemporalObservation{id:string;kind:string;value:number;time:string;region?:string;regime?:string;}
export interface TemporalPattern{
 id:string;from:string;to:string;occurrences:number;precision:number;
 medianLagDays:number;p10LagDays:number;p90LagDays:number;regimeCount:number;
 stability:number;score:number;status:"OBSERVED"|"PROMISING"|"RESEARCH"|"REJECTED";
}
export interface TemporalPatternReport{patterns:TemporalPattern[];best:TemporalPattern|null;audit:string[];}
const clamp=(x:number,a=0,b=1)=>Math.min(b,Math.max(a,x));
const median=(a:number[])=>{if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2};
const pct=(a:number,p:number)=>{if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y);return s[Math.floor((s.length-1)*p)]??0};
const lag=(a:string,b:string)=>(Date.parse(b)-Date.parse(a))/86400000;

function measure(xs:TemporalObservation[],from:string,to:string,maxLag:number){
 const starts=xs.filter(x=>x.kind===from),lags:number[]=[];
 for(const s of starts){
  const n=xs.filter(x=>x.kind===to&&Date.parse(x.time)>Date.parse(s.time))
   .sort((a,b)=>Date.parse(a.time)-Date.parse(b.time))[0];
  if(n){const d=lag(s.time,n.time);if(d>=0&&d<=maxLag)lags.push(d);}
 }
 return {starts,lags};
}

export function buildTemporalPatternReport(
 observations:TemporalObservation[],maxLagDays=365,minOccurrences=5
):TemporalPatternReport{
 const xs=observations.filter(x=>Number.isFinite(x.value)&&Number.isFinite(Date.parse(x.time)))
  .sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));
 const kinds=[...new Set(xs.map(x=>x.kind))],patterns:TemporalPattern[]=[];
 for(const from of kinds)for(const to of kinds){
  if(from===to)continue;
  const m=measure(xs,from,to,maxLagDays);
  if(m.lags.length<minOccurrences)continue;
  const regimeCount=new Set(m.starts.map(x=>x.regime??"UNKNOWN")).size;
  const precision=m.starts.length?m.lags.length/m.starts.length:0;
  const support=clamp(m.lags.length/Math.max(20,minOccurrences*4));
  const stability=clamp(.55*precision+.25*support+.20*clamp(regimeCount/3));
  const score=clamp(.45*precision+.20*support+.20*stability+.15*clamp(1-m.lags.length/200));
  patterns.push({
   id:`TEMP:${from}->${to}`,from,to,occurrences:m.lags.length,precision,
   medianLagDays:median(m.lags),p10LagDays:pct(m.lags,.1),p90LagDays:pct(m.lags,.9),
   regimeCount,stability,score,
   status:m.lags.length<10?"OBSERVED":score>=.7?"PROMISING":score>=.45?"RESEARCH":"REJECTED"
  });
 }
 patterns.sort((a,b)=>b.score-a.score);
 return {patterns,best:patterns[0]??null,audit:[
  "Only chronological observations are used.",
  "A temporal relationship is not treated as causal.",
  "Production eligibility requires point-in-time replay and out-of-sample validation.",
  "Lag distributions are preserved to expose timing uncertainty."
 ]};
}
