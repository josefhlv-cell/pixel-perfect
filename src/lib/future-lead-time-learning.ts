/**
 * Future Lead-Time Learning
 *
 * Learns which signals actually provide useful advance warning.
 * It is deliberately prequential: a signal can only receive credit from
 * outcomes that became observable after the signal was issued.
 */

export interface LeadTimeCase {
  signalId:string;
  sourceFamily:string;
  issuedAt:string;
  targetEventAt:string;
  predictedDirection:"UP"|"DOWN"|"NEUTRAL";
  actualDirection:"UP"|"DOWN"|"NEUTRAL";
  strength:number;
  falseAlarm:boolean;
  usefulWarning:boolean;
  outcomeQuality:number;
}

export interface SignalSkill {
  signalId:string;
  sourceFamily:string;
  cases:number;
  hitRate:number;
  falseAlarmRate:number;
  usefulWarningRate:number;
  medianLeadDays:number;
  weightedLeadDays:number;
  skill:number;
  status:"CHAMPION"|"CORE"|"LEARNING"|"REJECT";
}

export interface FutureLeadTimeLearningResult {
  skills:SignalSkill[];
  bestEarlyWarning:string|null;
  learnedLeadTimeDays:number|null;
  usableSignalCount:number;
  audit:string[];
}

const clamp=(x:number,a=0,b=1)=>Math.min(b,Math.max(a,x));
const median=(xs:number[])=>{
  if(!xs.length)return 0;
  const s=[...xs].sort((a,b)=>a-b),m=Math.floor(s.length/2);
  return s.length%2?s[m]:(s[m-1]+s[m])/2;
};

export function learnFutureLeadTime(cases:LeadTimeCase[],minCases=12):FutureLeadTimeLearningResult{
  const groups=new Map<string,LeadTimeCase[]>();
  for(const c of cases){
    if(c.outcomeQuality<.6)continue;
    const g=groups.get(c.signalId)??[];
    g.push(c);groups.set(c.signalId,g);
  }

  const skills=[...groups.entries()].map(([signalId,group])=>{
    const hitRate=group.filter(c=>c.predictedDirection===c.actualDirection).length/group.length;
    const falseAlarmRate=group.filter(c=>c.falseAlarm).length/group.length;
    const usefulWarningRate=group.filter(c=>c.usefulWarning).length/group.length;
    const leads=group.map(c=>Math.max(0,(Date.parse(c.targetEventAt)-Date.parse(c.issuedAt))/86400000));
    const weights=group.map(c=>clamp(c.strength));
    const weightedLead=leads.reduce((s,v,i)=>s+v*weights[i]!,0)/
      Math.max(1,weights.reduce((s,v)=>s+v,0));
    const sample=clamp(group.length/minCases);
    const skill=clamp(
      (.35*hitRate+.30*usefulWarningRate+.20*(1-falseAlarmRate)+.15*clamp(weightedLead/180))
      *sample
    );
    return {
      signalId,sourceFamily:group[0]!.sourceFamily,cases:group.length,
      hitRate,falseAlarmRate,usefulWarningRate,
      medianLeadDays:median(leads),weightedLeadDays:weightedLead,skill,
      status:group.length<minCases?"LEARNING":
        skill>=.75?"CHAMPION":skill>=.55?"CORE":skill>=.30?"LEARNING":"REJECT",
    };
  }).sort((a,b)=>b.skill-a.skill);

  const usable=skills.filter(s=>s.status==="CHAMPION"||s.status==="CORE");
  const best=usable[0]??null;
  const lead=usable.length
    ?usable.reduce((s,x)=>s+x.weightedLeadDays*x.skill,0)/
      Math.max(1,usable.reduce((s,x)=>s+x.skill,0))
    :null;

  return {
    skills,bestEarlyWarning:best?.signalId??null,
    learnedLeadTimeDays:lead==null?null:Math.round(lead),
    usableSignalCount:usable.length,
    audit:[
      "Signal skill is learned only from matured, quality-gated outcomes.",
      "Lead time is measured from signal issuance to realized target event.",
      "False alarms reduce skill; repeated useful warnings increase it.",
      "Small samples are shrunk toward insufficient evidence.",
    ],
  };
}
