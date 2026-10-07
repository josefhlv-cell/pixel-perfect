/**
 * Reality Investor — Prediction Judge.
 *
 * The Judge is deliberately not another predictor. It is a governance layer
 * that decides how much a forecast deserves to be trusted.
 *
 * A forecast can be accurate on average and still be unsafe when:
 * - its interval is miscalibrated,
 * - the current regime is unlike the training regime,
 * - spatial coverage is weak,
 * - models disagree,
 * - evidence is stale or only based on asking prices.
 */

export type JudgeStatus =
  | "TRUST"
  | "CAUTIOUS"
  | "WATCH"
  | "REJECT";

export interface EvidenceItem {
  id: string;
  kind:
    | "TRANSACTION"
    | "ASKING"
    | "RENT"
    | "MACRO"
    | "CREDIT"
    | "SUPPLY"
    | "DEMAND"
    | "SPATIAL"
    | "BEHAVIORAL"
    | "MODEL";
  observedAt: string;
  availableAt: string;
  quality: number;
  direction: number; // -1 to +1
  relevance: number; // 0 to 1
}

export interface ModelEvidence {
  model: string;
  oosScore: number;          // 0..1, higher is better
  calibration: number;       // 0..1, higher is better
  coverage: number;          // empirical interval coverage
  drift: number;             // 0..1, higher means more drift
  spatialValidity: number;   // 0..1
  sampleSize: number;
}

export interface ForecastJudgeInput {
  models: ModelEvidence[];
  evidence: EvidenceItem[];
  modelAgreement: number;    // 0..1
  regimeConfidence: number;  // 0..1
  dataFreshness: number;     // 0..1
  leakageDetected: boolean;
  transactionShare: number;  // 0..1
}

export interface ForecastJudge {
  status: JudgeStatus;
  trustScore: number;
  forecastQuality: number;
  evidenceQuality: number;
  stability: number;
  reasons: string[];
  blockers: string[];
  missingEvidence: string[];
}

/** Point-in-time guard: a future publication must never enter the evidence set. */
export function pointInTimeEvidence(
  items: EvidenceItem[],
  cutoff: string,
): EvidenceItem[] {
  const t = Date.parse(cutoff);
  return items.filter(x => Date.parse(x.availableAt) <= t);
}

function clamp(x:number,a:number,b:number){return Math.min(b,Math.max(a,x));}
function mean(xs:number[]){return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;}

export function judgeForecast(input: ForecastJudgeInput): ForecastJudge {
  const blockers:string[]=[];
  const reasons:string[]=[];
  const missingEvidence:string[]=[];

  if(input.leakageDetected) blockers.push("temporal leakage detected");

  const usable=input.models.filter(m=>m.sampleSize>=20);
  if(!usable.length) blockers.push("no model has sufficient out-of-sample history");

  const modelQuality=mean(usable.map(m =>
    0.30*clamp(m.oosScore,0,1) +
    0.25*clamp(m.calibration,0,1) +
    0.15*clamp(m.coverage/0.90,0,1) +
    0.15*clamp(1-m.drift,0,1) +
    0.15*clamp(m.spatialValidity,0,1)
  ));

  const evidenceQuality=mean(input.evidence.map(e =>
    clamp(e.quality,0,1)*clamp(e.relevance,0,1)
  ));

  const stability=
    0.35*clamp(input.modelAgreement,0,1)+
    0.30*clamp(input.regimeConfidence,0,1)+
    0.20*clamp(input.dataFreshness,0,1)+
    0.15*clamp(input.transactionShare,0,1);

  const trustScore=clamp(
    100*(0.45*modelQuality+0.25*evidenceQuality+0.30*stability),
    0,100
  );

  if(input.transactionShare<0.25)
    missingEvidence.push("more realized transaction observations");
  if(input.modelAgreement<0.55)
    missingEvidence.push("better agreement between independent model families");
  if(input.regimeConfidence<0.55)
    missingEvidence.push("more evidence about the current market regime");
  if(input.dataFreshness<0.60)
    missingEvidence.push("fresher market observations");
  if(input.evidence.filter(e=>e.kind==="SPATIAL").length===0)
    missingEvidence.push("spatial/micro-market evidence");

  if(modelQuality>=0.72) reasons.push("models show strong out-of-sample performance");
  if(evidenceQuality>=0.70) reasons.push("evidence quality is strong");
  if(input.modelAgreement>=0.75) reasons.push("independent models broadly agree");
  if(input.regimeConfidence>=0.75) reasons.push("current regime is well identified");
  if(input.transactionShare>=0.60) reasons.push("forecast is substantially anchored in realized transactions");

  let status:JudgeStatus;
  if(blockers.length) status="REJECT";
  else if(trustScore>=78 && modelQuality>=0.70 && input.regimeConfidence>=0.65) status="TRUST";
  else if(trustScore>=58) status="CAUTIOUS";
  else status="WATCH";

  if(status==="TRUST" && input.transactionShare<0.40){
    status="CAUTIOUS";
    reasons.push("trust capped because realized transaction share is still limited");
  }

  return {
    status,
    trustScore,
    forecastQuality:modelQuality,
    evidenceQuality,
    stability,
    reasons,
    blockers,
    missingEvidence,
  };
}

/**
 * Adversarial self-critique.
 * Returns the strongest reasons the forecast should be wrong, not reasons
 * supporting it. This is intentionally deterministic and auditable.
 */
export function adversarialCritique(input: ForecastJudgeInput): string[] {
  const out:string[]=[];
  if(input.transactionShare<0.40)
    out.push("asking-price selection bias may be mistaken for transaction-price movement");
  if(input.modelAgreement<0.55)
    out.push("model disagreement indicates structural uncertainty");
  if(input.regimeConfidence<0.55)
    out.push("regime uncertainty can make historical relationships unstable");
  if(input.dataFreshness<0.60)
    out.push("stale observations can miss a turning point");
  if(input.models.some(m=>m.drift>0.35))
    out.push("feature drift suggests the training distribution may no longer represent today");
  if(input.models.some(m=>m.coverage<0.80))
    out.push("at least one model's uncertainty interval is materially under-covered");
  if(!input.evidence.some(e=>e.kind==="SPATIAL"))
    out.push("local spatial effects are insufficiently observed");
  if(!out.length) out.push("no dominant failure mode detected; continue falsification testing");
  return out;
}
