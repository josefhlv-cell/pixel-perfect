/**
 * Reality Investor — Early Warning Lead-Time Lab.
 *
 * Measures whether a warning arrives before a defined market event and how
 * stable the warning remains. Accuracy without lead time is insufficient for
 * an investment decision.
 */

export type WarningSeverity="WATCH"|"ALERT"|"CRITICAL";
export interface WarningPoint {
  observedAt:string;
  score:number;
  severity:WarningSeverity;
}
export interface MarketEvent {
  id:string;
  occurredAt:string;
  kind:"CORRECTION"|"ACCELERATION"|"LIQUIDITY_STRESS"|"REGIME_SHIFT";
}
export interface LeadTimeResult {
  eventId:string;
  warningAt:string|null;
  leadDays:number|null;
  severityAtWarning:WarningSeverity|null;
  falseAlarm:boolean;
  persistenceDays:number;
  useful:boolean;
}
export interface EarlyWarningReport {
  events:LeadTimeResult[];
  medianLeadDays:number|null;
  earliestLeadDays:number|null;
  usefulWarningRate:number;
  falseAlarmRate:number;
  score:number;
}

function severity(score:number):WarningSeverity{
  if(score>=.80)return "CRITICAL";
  if(score>=.60)return "ALERT";
  return "WATCH";
}

function days(a:string,b:string):number{
  return (Date.parse(b)-Date.parse(a))/86400000;
}

export function evaluateEarlyWarnings(
  warnings:WarningPoint[],
  events:MarketEvent[],
  horizonDays=180,
):EarlyWarningReport{
  const sorted=[...warnings].sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt));
  const results:LeadTimeResult[]=events.map(event=>{
    const candidates=sorted.filter(w=>{
      const d=days(w.observedAt,event.occurredAt);
      return d>=0&&d<=horizonDays&&w.score>=.60;
    });
    const first=candidates[0];
    if(!first)return {
      eventId:event.id,warningAt:null,leadDays:null,severityAtWarning:null,
      falseAlarm:true,persistenceDays:0,useful:false
    };
    const later=sorted.filter(w=>Date.parse(w.observedAt)>=Date.parse(first.observedAt)
      &&Date.parse(w.observedAt)<=Date.parse(event.occurredAt));
    const persistence=later.length>1
      ? Math.max(0,days(first.observedAt,later.at(-1)!.observedAt)):0;
    const lead=days(first.observedAt,event.occurredAt);
    return {
      eventId:event.id,warningAt:first.observedAt,leadDays:lead,
      severityAtWarning:severity(first.score),falseAlarm:false,
      persistenceDays:persistence,useful:lead>=7&&persistence>=7
    };
  });

  const valid=results.filter(x=>x.leadDays!=null);
  const leads=valid.map(x=>x.leadDays!).sort((a,b)=>a-b);
  const useful=results.filter(x=>x.useful).length;
  const falseAlarms=results.filter(x=>x.falseAlarm).length;
  const n=Math.max(1,results.length);

  return {
    events:results,
    medianLeadDays:leads.length?leads[Math.floor(leads.length/2)]!:null,
    earliestLeadDays:leads.length?Math.max(...leads):null,
    usefulWarningRate:useful/n,
    falseAlarmRate:falseAlarms/n,
    score:Math.max(0,Math.min(100,100*(.55*(useful/n)+.30*Math.min(1,(leads.length?leads.reduce((a,b)=>a+b,0)/leads.length:0)/90)+.15*(1-falseAlarms/n))))
  };
}
