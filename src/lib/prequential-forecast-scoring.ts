/**
 * Reality Investor — Prequential Forecast Scoring.
 *
 * Scores forecasts in chronological order: issue forecast -> observe outcome ->
 * score -> update. This mirrors real deployment and avoids retrospective
 * reshuffling of forecast cases.
 */

export interface PrequentialCase {
  issuedAt:string;
  probabilities:Record<string,number>;
  outcome:string;
}

export interface PrequentialScore {
  cases:number;
  brier:number|null;
  logLoss:number|null;
  directionalAccuracy:number|null;
  meanConfidence:number|null;
}

const normalize=(p:Record<string,number>)=>{
  const keys=Object.keys(p);
  const sum=keys.reduce((s,k)=>s+Math.max(0,p[k]??0),0)||1;
  return Object.fromEntries(keys.map(k=>[k,Math.max(0,p[k]??0)/sum]));
};

export function scorePrequential(cases:PrequentialCase[]):PrequentialScore{
  const ordered=[...cases].sort((a,b)=>a.issuedAt.localeCompare(b.issuedAt));
  if(!ordered.length)return {cases:0,brier:null,logLoss:null,directionalAccuracy:null,meanConfidence:null};

  let brier=0,logLoss=0,hits=0,confidence=0;
  for(const c of ordered){
    const p=normalize(c.probabilities);
    const keys=Object.keys(p);
    const winner=keys.reduce((best,k)=>(p[k]!>p[best!] ? k:best),keys[0]!);
    const actual=p[c.outcome]??0;
    brier+=keys.reduce((s,k)=>s+Math.pow(p[k]!-Number(k===c.outcome),2),0);
    logLoss+=-Math.log(Math.max(1e-6,actual));
    hits+=winner===c.outcome?1:0;
    confidence+=p[winner]??0;
  }
  return {
    cases:ordered.length,
    brier:brier/ordered.length,
    logLoss:logLoss/ordered.length,
    directionalAccuracy:hits/ordered.length,
    meanConfidence:confidence/ordered.length,
  };
}
