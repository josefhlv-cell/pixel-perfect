/**
 * Reality Investor — Bayesian evidence updater.
 *
 * Forecasts are beliefs conditioned on evidence, not truths.
 * The update is intentionally explicit: prior odds × likelihood ratio.
 * Likelihood ratios must eventually be learned/calibrated from OOS data.
 */

export interface EvidenceLikelihood{
  name:string;
  direction:"BULLISH"|"BEARISH"|"NEUTRAL";
  likelihoodRatio:number;
  reliability:number;
  sourceQuality:number;
  timestamp?:string;
}

export interface BayesianState{
  priorProbability:number;
  posteriorProbability:number;
  logOdds:number;
  evidenceWeight:number;
  entropy:number;
  strongestEvidence:string[];
  contradictions:string[];
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

function entropy(p:number){
  const q=clamp(p,1e-12,1-1e-12);
  return -(q*Math.log2(q)+(1-q)*Math.log2(1-q));
}

export function updateProbability(
  priorProbability:number,
  evidence:EvidenceLikelihood[],
):BayesianState{
  let logOdds=Math.log(clamp(priorProbability,1e-6,1-1e-6)/(1-clamp(priorProbability,1e-6,1-1e-6)));
  for(const e of evidence){
    const lr=Math.max(1/1000,Math.min(1000,e.likelihoodRatio));
    const reliability=clamp(e.reliability,0,1)*clamp(e.sourceQuality,0,1);
    const signed=Math.log(lr)*(e.direction==="BEARISH"?-1:e.direction==="NEUTRAL"?0:1);
    logOdds+=signed*reliability;
  }
  const posterior=1/(1+Math.exp(-clamp(logOdds,-30,30)));
  const bull=evidence.filter(e=>e.direction==="BULLISH").sort((a,b)=>b.reliability*b.sourceQuality-a.reliability*a.sourceQuality);
  const bear=evidence.filter(e=>e.direction==="BEARISH").sort((a,b)=>b.reliability*b.sourceQuality-a.reliability*a.sourceQuality);
  return {
    priorProbability,
    posteriorProbability:clamp(posterior,0.001,0.999),
    logOdds,
    evidenceWeight:evidence.reduce((s,e)=>s+clamp(e.reliability,0,1)*clamp(e.sourceQuality,0,1),0),
    entropy:entropy(posterior),
    strongestEvidence:bull.slice(0,3).map(e=>e.name),
    contradictions:bear.slice(0,3).map(e=>e.name)
  };
}

export function probabilityShift(prior:number,posterior:number){
  return posterior-prior;
}

export function expectedValue(outcomes:{value:number;probability:number}[]){
  const total=outcomes.reduce((s,x)=>s+x.probability,0);
  return total?outcomes.reduce((s,x)=>s+x.value*x.probability,0)/total:0;
}

export function expectedUtility(outcomes:{value:number;probability:number}[],riskAversion=1){
  return outcomes.reduce((s,x)=>{
    const utility=riskAversion===1?x.value:(x.value>=0?x.value**(1/riskAversion):-Math.abs(x.value)**(1/riskAversion));
    return s+x.probability*utility;
  },0);
}
