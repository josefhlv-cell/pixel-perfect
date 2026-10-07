/**
 * Reality Investor — Future Trajectory Engine.
 *
 * Converts competing future hypotheses into a time-indexed trajectory.
 * The engine is deliberately explicit about uncertainty and calibration:
 * without historical OOS calibration, state probabilities are structural
 * support scores rather than empirical probabilities.
 */

import type {FutureHypothesis, FutureHypothesisId, FutureStateVector} from "./future-state-lab";

export type TrajectoryHorizon=1|3|6|12|24|36;

export type TrajectoryRegime=
  |"ACCELERATION"
  |"SOFT_LANDING"
  |"DECELERATION"
  |"CORRECTION"
  |"LIQUIDITY_CRISIS"
  |"RECOVERY";

export interface FutureEvidenceEvent {
  id:string;
  observedAt:string;
  availableAt:string;
  hypothesis:FutureHypothesisId;
  support:number;
  reliability:number;
  sourceQuality:number;
  halfLifeMonths?:number;
  reason:string;
}

export interface TrajectoryPoint {
  month:number;
  horizon:TrajectoryHorizon|number;
  p10PriceGrowth:number;
  p25PriceGrowth:number;
  p50PriceGrowth:number;
  p75PriceGrowth:number;
  p90PriceGrowth:number;
  p50RentGrowth:number;
  dominantRegime:TrajectoryRegime;
  regimeSupport:number;
  transitionRisk:number;
  ambiguity:number;
}

export interface FutureTrajectoryResult {
  calibrationStatus:"STRUCTURAL_UNCALIBRATED"|"EMPIRICALLY_CALIBRATED";
  points:TrajectoryPoint[];
  dominantPath:TrajectoryRegime;
  pathEntropy:number;
  turningPointMonth:number|null;
  nextBestObservation:string;
  evidenceImpact:number;
  audit:string[];
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

function entropy(ps:number[]):number{
  const valid=ps.filter(p=>p>0);
  if(valid.length<2)return 0;
  const h=-valid.reduce((s,p)=>s+p*Math.log(p),0);
  return clamp(h/Math.log(valid.length),0,1);
}

function weightedEvidence(
  hypothesis:FutureHypothesisId,
  events:FutureEvidenceEvent[],
  month:number,
):number{
  return events.reduce((sum,e)=>{
    if(e.hypothesis!==hypothesis)return sum;
    const halfLife=Math.max(.5,e.halfLifeMonths??6);
    const age=Math.max(0,month);
    const recency=Math.pow(.5,age/halfLife);
    return sum+e.support*clamp(e.reliability,0,1)*clamp(e.sourceQuality,0,1)*recency;
  },0);
}

function normalize(xs:number[]):number[]{
  const total=xs.reduce((a,b)=>a+b,0);
  if(total<=0)return xs.map(()=>1/xs.length);
  return xs.map(x=>x/total);
}

function quantiles(values:number[]):{p10:number;p25:number;p50:number;p75:number;p90:number}{
  const sorted=[...values].sort((a,b)=>a-b);
  const q=(p:number)=>{
    const index=(sorted.length-1)*p;
    const lo=Math.floor(index);
    const hi=Math.ceil(index);
    if(lo===hi)return sorted[lo]??0;
    const w=index-lo;
    return (sorted[lo]??0)*(1-w)+(sorted[hi]??0)*w;
  };
  return {p10:q(.10),p25:q(.25),p50:q(.50),p75:q(.75),p90:q(.90)};
}

/**
 * Builds a transparent multi-horizon trajectory from competing hypotheses.
 *
 * Important: this is a structural trajectory generator. Its probabilities
 * become empirical only after historical point-in-time replay and calibration.
 */
export function buildFutureTrajectory(
  state:FutureStateVector,
  hypotheses:FutureHypothesis[],
  events:FutureEvidenceEvent[]=[],
  horizons:TrajectoryHorizon[]=[1,3,6,12,24,36],
):FutureTrajectoryResult{
  const ids:FutureHypothesisId[]=[
    "ACCELERATION","SOFT_LANDING","DECELERATION","CORRECTION","LIQUIDITY_CRISIS","RECOVERY"
  ];

  const byId=new Map(hypotheses.map(h=>[h.id,h]));
  const audit=[
    "Structural scenario weights are not empirical probabilities until calibrated on point-in-time historical outcomes.",
    "Trajectory uncertainty widens with horizon and transition risk.",
    "Evidence is weighted by reliability, source quality and recency.",
  ];

  const baseWeights=normalize(ids.map(id=>Math.max(.0001,byId.get(id)?.probability??0)));
  const initialDominant=ids[baseWeights.indexOf(Math.max(...baseWeights))]??"SOFT_LANDING";

  const points:TrajectoryPoint[]=[];
  let previousDominant=initialDominant;
  let turningPointMonth:number|null=null;

  for(const month of horizons){
    const support=ids.map((id,i)=>{
      const evidence=weightedEvidence(id,events,month);
      const structural=baseWeights[i]??0;
      return Math.max(.0001,structural*Math.exp(evidence));
    });
    const probs=normalize(support);
    const h=entropy(probs);

    const candidates:number[]=[];
    const rentCandidates:number[]=[];
    ids.forEach((id,i)=>{
      const hyp=byId.get(id);
      if(!hyp)return;
      const weight=probs[i]??0;
      const annualizedPrice=hyp.expectedPriceGrowth/(Math.max(.25,state.horizonMonths)/12);
      const annualizedRent=hyp.expectedRentGrowth/(Math.max(.25,state.horizonMonths)/12);
      candidates.push(annualizedPrice*(month/12)*weight);
      rentCandidates.push(annualizedRent*(month/12)*weight);
    });

    // Scenario dispersion is used as a transparent structural uncertainty proxy.
    const mean=candidates.reduce((a,b)=>a+b,0);
    const variance=ids.reduce((sum,id,i)=>{
      const hyp=byId.get(id);
      if(!hyp)return sum;
      const weight=probs[i]??0;
      const annualized=hyp.expectedPriceGrowth/(Math.max(.25,state.horizonMonths)/12);
      const value=annualized*(month/12);
      return sum+weight*Math.pow(value-mean,2);
    },0);

    const transitionRisk=clamp(
      state.mortgageRateChange*2+
      Math.max(0,state.inventoryGrowth)*1.1+
      Math.max(0,state.domChange)*.8+
      Math.abs(state.creditGrowth)*.6,
      0,1
    );

    const spread=Math.sqrt(Math.max(0,variance))*(1+transitionRisk)*(1+.12*Math.sqrt(month));
    const q={p10:mean-spread,p25:mean-spread*.5,p50:mean,p75:mean+spread*.5,p90:mean+spread};

    const dominantIndex=probs.indexOf(Math.max(...probs));
    const dominant=(ids[dominantIndex]??initialDominant) as TrajectoryRegime;
    if(dominant!==previousDominant && turningPointMonth===null)turningPointMonth=month;
    previousDominant=dominant;

    points.push({
      month,
      horizon:month,
      p10PriceGrowth:q.p10,
      p25PriceGrowth:q.p25,
      p50PriceGrowth:q.p50,
      p75PriceGrowth:q.p75,
      p90PriceGrowth:q.p90,
      p50RentGrowth:rentCandidates.reduce((a,b)=>a+b,0),
      dominantRegime:dominant,
      regimeSupport:probs[dominantIndex]??0,
      transitionRisk,
      ambiguity:h,
    });
  }

  const final=points.at(-1);
  const finalWeights=normalize(ids.map((id,i)=>{
    const evidence=weightedEvidence(id,events,final?.month??12);
    return Math.max(.0001,(baseWeights[i]??0)*Math.exp(evidence));
  }));
  const finalDominant=(ids[finalWeights.indexOf(Math.max(...finalWeights))]??initialDominant) as TrajectoryRegime;

  const nextBest=finalDominant==="CORRECTION"||finalDominant==="LIQUIDITY_CRISIS"
    ?"transaction volume + mortgage approvals + new listings"
    :finalDominant==="ACCELERATION"
      ?"new listings + mortgage approvals + search demand"
      :finalDominant==="RECOVERY"
        ?"rent growth + vacancy + mortgage rates"
        :"transactions + DOM + price reductions";

  return {
    calibrationStatus:"STRUCTURAL_UNCALIBRATED",
    points,
    dominantPath:finalDominant,
    pathEntropy:entropy(finalWeights),
    turningPointMonth,
    nextBestObservation:nextBest,
    evidenceImpact:events.length?clamp(events.reduce((s,e)=>s+Math.abs(e.support)*e.reliability*e.sourceQuality,0),0,1):0,
    audit,
  };
}

/**
 * Creates a compact evidence event for a new observation.
 * Support is intentionally supplied by the caller so the research layer
 * can later learn likelihood ratios from historical frequencies.
 */
export function trajectoryEvidence(
  id:string,
  hypothesis:FutureHypothesisId,
  support:number,
  observedAt:string,
  availableAt:string,
  reason:string,
  reliability=1,
  sourceQuality=1,
):FutureEvidenceEvent{
  return {
    id, hypothesis, support:clamp(support,-2,2), observedAt, availableAt,
    reliability:clamp(reliability,0,1),
    sourceQuality:clamp(sourceQuality,0,1),
    reason,
  };
}
