/**
 * Reality Investor — Forecast Constitution.
 *
 * Central governance gate for production forecasts. It does not improve a model;
 * it prevents the system from presenting an unsupported forecast as reliable.
 */

export type ConstitutionStatus="ALLOW"|"CAUTION"|"BLOCK";

export interface ConstitutionInput {
  pointInTimeValid:boolean;
  vintageValid:boolean;
  evidenceQuality:number;
  calibrationQuality:number;
  driftRisk:number;
  modelDisagreement:number;
  outcomeCount:number;
  minimumOutcomes:number;
}

export interface ConstitutionDecision {
  status:ConstitutionStatus;
  confidenceMultiplier:number;
  reasons:string[];
  requiredActions:string[];
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

export function judgeForecastConstitution(
  i:ConstitutionInput,
):ConstitutionDecision{
  const reasons:string[]=[];
  const required:string[]=[];

  if(!i.pointInTimeValid){
    reasons.push("TEMPORAL_LEAKAGE_OR_INVALID_CUTOFF");
    required.push("Rebuild forecast using point-in-time observations.");
  }
  if(!i.vintageValid){
    reasons.push("INVALID_DATA_VINTAGE");
    required.push("Restore the immutable source vintage.");
  }
  if(i.evidenceQuality<.35){
    reasons.push("LOW_EVIDENCE_QUALITY");
    required.push("Collect higher-truth observations.");
  }
  if(i.calibrationQuality<.45){
    reasons.push("WEAK_CALIBRATION");
    required.push("Run additional out-of-sample calibration.");
  }
  if(i.driftRisk>.65){
    reasons.push("HIGH_DATA_OR_CONCEPT_DRIFT");
    required.push("Downweight stale models and collect current outcomes.");
  }
  if(i.modelDisagreement>.70){
    reasons.push("HIGH_MODEL_DISAGREEMENT");
    required.push("Expose uncertainty and avoid aggressive action.");
  }
  if(i.outcomeCount<i.minimumOutcomes){
    reasons.push("INSUFFICIENT_REALIZED_OUTCOMES");
    required.push("Do not claim empirical performance yet.");
  }

  const hardBlock=!i.pointInTimeValid||!i.vintageValid;
  const caution=reasons.length>0;
  const status:ConstitutionStatus=hardBlock
    ?"BLOCK"
    :caution
      ?"CAUTION"
      :"ALLOW";

  const multiplier=status==="BLOCK"
    ?0
    :status==="CAUTION"
      ?clamp(
        .55+
        i.evidenceQuality*.2+
        i.calibrationQuality*.2-
        i.driftRisk*.15-
        i.modelDisagreement*.15,
        .25,.85
      )
      :clamp(
        .75+i.evidenceQuality*.1+i.calibrationQuality*.1-
        i.driftRisk*.05-i.modelDisagreement*.05,
        .5,1
      );

  return {
    status,
    confidenceMultiplier:multiplier,
    reasons,
    requiredActions:[...new Set(required)],
  };
}
