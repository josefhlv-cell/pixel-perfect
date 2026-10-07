/**
 * Reality Investor — Future Evidence Ledger.
 *
 * Maintains competing future hypotheses and updates their support as new,
 * point-in-time observations arrive. Evidence is reliability-weighted and
 * source-quality-weighted. The ledger never converts a structural prior into
 * a claim of empirical probability unless calibration data exist.
 */

export interface FutureHypothesisState {
  id:string;
  prior:number;
  posterior:number;
  support:number;
  contradiction:number;
  status:"LEADING"|"COMPETING"|"WEAKENING"|"FALSIFIED";
}

export interface FutureEvidence {
  id:string;
  observedAt:string;
  feature:string;
  value:number;
  sourceQuality:number;
  reliability:number;
  likelihoods:Record<string,number>;
  note?:string;
}

export interface FutureLedger {
  states:FutureHypothesisState[];
  evidence:FutureEvidence[];
  entropy:number;
  transitionSignal:number;
  dominant:string|null;
  falsified:string[];
  audit:string[];
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

function normalize(xs:number[]):number[]{
  const s=xs.reduce((a,b)=>a+b,0)||1;
  return xs.map(x=>x/s);
}

function entropy(ps:number[]):number{
  return -ps.reduce((s,p)=>s+(p>0?p*Math.log(p):0),0);
}

/**
 * likelihoods are relative support factors. 1 = neutral, >1 supports,
 * <1 contradicts. They are not probabilities.
 */
export function updateFutureLedger(
  states:FutureHypothesisState[],
  evidence:FutureEvidence,
):FutureLedger{
  const next=states.map(s=>{
    const lr=clamp(evidence.likelihoods[s.id] ?? 1,.05,20);
    const strength=clamp(evidence.sourceQuality*evidence.reliability,.05,1);
    const tempered=Math.pow(lr,strength);
    const raw=s.prior*Math.max(.05,tempered);
    const support=tempered>1 ? s.support+(tempered-1)*strength : s.support;
    const contradiction=tempered<1 ? s.contradiction+(1-tempered)*strength : s.contradiction;
    return {...s,prior:raw,support,contradiction};
  });

  const ps=normalize(next.map(s=>s.prior));
  const normalized=next.map((s,i)=>{
    const p=ps[i]!;
    const status=s.contradiction>.9&&p<.03?"FALSIFIED":
      p>=.45?"LEADING":p>=.12?"COMPETING":"WEAKENING";
    return {...s,posterior:p,status};
  });

  const dominant=[...normalized].sort((a,b)=>b.posterior-a.posterior)[0] ?? null;
  const second= [...normalized].sort((a,b)=>b.posterior-a.posterior)[1];
  const transitionSignal=dominant&&second
    ? clamp((dominant.posterior-second.posterior)*2,0,1)
    : 0;

  return {
    states:normalized,
    evidence:[evidence],
    entropy:entropy(ps),
    transitionSignal,
    dominant:dominant?.id ?? null,
    falsified:normalized.filter(s=>s.status==="FALSIFIED").map(s=>s.id),
    audit:[
      "Evidence updates relative support using reliability and source quality.",
      "Likelihood factors are evidence scores, not empirically calibrated probabilities.",
      "Falsification requires repeated contradiction; one noisy observation should not erase a hypothesis."
    ]
  };
}

export function replayFutureLedger(
  initial:FutureHypothesisState[],
  evidence:FutureEvidence[],
):FutureLedger{
  let states=initial;
  let ledger:FutureLedger={
    states,evidence:[],entropy:entropy(states.map(s=>s.prior)),
    transitionSignal:0,dominant:null,falsified:[],audit:[]
  };
  for(const e of evidence){
    ledger=updateFutureLedger(states,e);
    states=ledger.states;
  }
  return {...ledger,evidence,states};
}
