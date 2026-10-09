/**
 * Future Knowledge Engine
 *
 * Turns heterogeneous leading signals into an auditable "time-to-know" view.
 *
 * Design principle:
 *   signal -> causal mechanism -> competing future -> expected timing
 *          -> independent evidence -> invalidation -> decision advantage
 *
 * This is deliberately NOT clairvoyance. It measures how early the system
 * has evidence that a future state is becoming more likely.
 */

export type SignalDirection = "UP" | "DOWN" | "NEUTRAL";
export type SignalQuality = "HIGH" | "MEDIUM" | "LOW";
export type FutureState = "ACCELERATION" | "SOFT_LANDING" | "DECELERATION" | "CORRECTION" | "LIQUIDITY_CRISIS" | "RECOVERY";

export interface KnowledgeSignal {
  id: string;
  observedAt: string;
  sourceFamily: string;
  direction: SignalDirection;
  strength: number;       // 0..1
  quality: SignalQuality;
  leadDays?: number;
  persistenceDays?: number;
  mechanism: string;
  futureStates: FutureState[];
  independentGroup?: string;
  invalidator?: string;
}

export interface FutureHypothesis {
  state: FutureState;
  prior: number;
  expectedImpact: number;
}

export interface FutureKnowledgeInput {
  now: string;
  signals: KnowledgeSignal[];
  hypotheses: FutureHypothesis[];
  modelRisk: number;
  dataCoverage: number;
}

export interface FutureStateKnowledge {
  state: FutureState;
  support: number;
  confidence: number;
  evidenceCount: number;
  independentEvidenceGroups: number;
  medianLeadDays: number;
  earliestLeadDays: number;
  persistence: number;
  contradiction: number;
}

export interface FutureKnowledgeOutput {
  leadingState: FutureState | null;
  states: FutureStateKnowledge[];
  timeToKnowDays: number | null;
  informationAdvantageDays: number | null;
  evidenceVelocity: number;
  stability: number;
  confidenceCap: number;
  actionability: "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT";
  invalidationRules: string[];
  audit: string[];
}

const clamp = (x:number,a=0,b=1)=>Math.min(b,Math.max(a,x));
const median = (xs:number[]) => {
  if (!xs.length) return 0;
  const s=[...xs].sort((a,b)=>a-b);
  const m=Math.floor(s.length/2);
  return s.length%2?s[m]:(s[m-1]+s[m])/2;
};

const qualityWeight:Record<SignalQuality,number>={HIGH:1,MEDIUM:.75,LOW:.45};

function independentGroups(signals:KnowledgeSignal[]):number {
  return new Set(signals.map(s=>s.independentGroup??s.sourceFamily)).size;
}

/**
 * Correlated/copycat evidence is compressed: ten signals from one source
 * family should not masquerade as ten independent confirmations.
 */
function effectiveEvidence(signals:KnowledgeSignal[]):number {
  const groups=new Map<string,number>();
  for(const s of signals){
    const key=s.independentGroup??s.sourceFamily;
    const contribution=clamp(s.strength)*qualityWeight[s.quality];
    groups.set(key,Math.max(groups.get(key)??0,contribution));
  }
  const values=[...groups.values()].sort((a,b)=>b-a);
  return values.reduce((sum,v,i)=>sum+v*Math.pow(.78,i),0);
}

export function buildFutureKnowledge(x:FutureKnowledgeInput):FutureKnowledgeOutput {
  const states=x.hypotheses.map(h=>{
    const relevant=x.signals.filter(s=>s.futureStates.includes(h.state));
    const opposing=x.signals.filter(s=>!s.futureStates.includes(h.state)&&s.direction!=="NEUTRAL");
    const support=effectiveEvidence(relevant);
    const opposition=effectiveEvidence(opposing);
    const groups=independentGroups(relevant);
    const persistence=clamp(relevant.reduce((a,s)=>a+clamp((s.persistenceDays??0)/30)*clamp(s.strength),0)/(Math.max(1,relevant.length)));
    const leadTimes=relevant.map(s=>s.leadDays).filter((v):v is number=>Number.isFinite(v));
    const contradiction=clamp(opposition/(support+opposition+1e-9));
    const supportScore=clamp(
      .42*clamp(support/3)+
      .20*clamp(groups/5)+
      .16*persistence+
      .12*clamp(h.prior)+
      .10*clamp(h.expectedImpact),
    );
    const confidence=clamp(
      supportScore*(1-contradiction*.65)*(1-x.modelRisk*.45)*(.55+.45*x.dataCoverage)
    );
    return {
      state:h.state,
      support:supportScore,
      confidence,
      evidenceCount:relevant.length,
      independentEvidenceGroups:groups,
      medianLeadDays:median(leadTimes),
      earliestLeadDays:leadTimes.length?Math.min(...leadTimes):0,
      persistence,
      contradiction,
    };
  }).sort((a,b)=>b.confidence-a.confidence);

  const top=states[0]??null;
  const second=states[1]??null;
  const separation=top?clamp(top.confidence-(second?.confidence??0)):0;

  const leadPool=x.signals
    .filter(s=>s.leadDays!=null&&s.strength>.25)
    .map(s=>({days:s.leadDays!,weight:s.strength*qualityWeight[s.quality]}))
    .sort((a,b)=>a.days-b.days);
  const timeToKnowDays=leadPool.length?Math.max(1,Math.round(
    leadPool.reduce((a,v)=>a+v.days*v.weight,0)/leadPool.reduce((a,v)=>a+v.weight,0)
  )):null;

  const positiveVelocity=x.signals.reduce((a,s)=>a+clamp(s.strength)*qualityWeight[s.quality]*(s.persistenceDays??0),0);
  const evidenceVelocity=clamp(positiveVelocity/Math.max(30,x.signals.length*45));
  const stability=top?clamp(.45*separation+.30*top.persistence+.25*(1-top.contradiction)):0;
  const confidenceCap=clamp(
    .25+.50*stability+.25*x.dataCoverage-x.modelRisk*.35
  );

  const actionability=top&&top.confidence>=.72&&stability>=.62?"HIGH":
    top&&top.confidence>=.52?"MEDIUM":
    top&&top.confidence>=.30?"LOW":"INSUFFICIENT";

  const invalidationRules=top
    ? x.signals.filter(s=>s.futureStates.includes(top.state)&&s.invalidator)
      .slice(0,5).map(s=>s.invalidator!)
    : [];

  const informationAdvantageDays=timeToKnowDays==null?null:Math.max(0,Math.round(
    timeToKnowDays*(.35+.65*stability)
  ));

  return {
    leadingState:top?.state??null,
    states,
    timeToKnowDays,
    informationAdvantageDays,
    evidenceVelocity,
    stability,
    confidenceCap,
    actionability,
    invalidationRules,
    audit:[
      "Evidence is weighted by quality and compressed by source independence.",
      "Confidence is capped by data coverage, model risk and contradictory evidence.",
      "Time-to-know is an evidence-timing metric, not a claim about the future.",
      "No future state is accepted as certain; invalidation remains explicit.",
    ],
  };
}
