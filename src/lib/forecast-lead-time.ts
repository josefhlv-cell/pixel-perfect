/**
 * Forecast Lead-Time Lab — measures whether a warning arrives before the event.
 */
export interface Warning{date:string;strength:number;label:string;}
export interface Event{date:string;label:string;}
export interface LeadTimeResult{matched:boolean;leadDays:number|null;falseAlarm:boolean;useful:boolean;}
export function measureLeadTime(warnings:Warning[],events:Event[],maxGapDays=180):LeadTimeResult[]{
 return warnings.map(w=>{
  const t=Date.parse(w.date);
  const e=events.filter(x=>Date.parse(x.date)>=t).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date))[0];
  if(!e)return {matched:false,leadDays:null,falseAlarm:true,useful:false};
  const d=Math.round((Date.parse(e.date)-t)/86400000);
  return {matched:d<=maxGapDays,leadDays:d,falseAlarm:false,useful:d>=7&&w.strength>=.5};
 });
}
export function warningUtility(results:LeadTimeResult[]):number{
 if(!results.length)return 0;
 const useful=results.filter(x=>x.useful).length/results.length;
 const falseAlarms=results.filter(x=>x.falseAlarm).length/results.length;
 return useful-falseAlarms*.75;
}
