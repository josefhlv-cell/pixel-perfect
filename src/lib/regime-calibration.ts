/**
 * Reality Investor — Regime-Aware Calibration.
 *
 * Static calibration can fail exactly when the market changes regime. This
 * layer keeps calibration buckets by regime and applies a conservative
 * shrinkage when a bucket has little evidence.
 */

export interface CalibrationBucket {
  regime:string;
  group:string;
  samples:number;
  coverage90:number;
  meanAbsErrorBps:number;
  lastUpdated:string;
}

export interface CalibrationAdjustment {
  radiusMultiplier:number;
  confidenceMultiplier:number;
  reason:string;
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

export function calibrateByRegime(
  bucket:CalibrationBucket|null,
  targetCoverage=.90,
):CalibrationAdjustment{
  if(!bucket||bucket.samples<30){
    return {
      radiusMultiplier:1.15,
      confidenceMultiplier:.70,
      reason:"insufficient regime-specific evidence; conservative shrinkage"
    };
  }

  const coverageGap=targetCoverage-bucket.coverage90;
  const multiplier=clamp(1+coverageGap*2.5,.75,1.75);
  const confidence=clamp(
    .55+.35*Math.min(1,bucket.samples/250)-Math.abs(coverageGap),
    .20,.95
  );

  return {
    radiusMultiplier:multiplier,
    confidenceMultiplier:confidence,
    reason:
      coverageGap>0
        ?"historical interval under-coverage; widen uncertainty":
      coverageGap<-.05
        ?"interval appears over-wide; modestly sharpen":
      "coverage near target"
  };
}

export function applyCalibration(
  p10:number,p50:number,p90:number,
  adjustment:CalibrationAdjustment,
){
  const lowerDistance=p50-p10;
  const upperDistance=p90-p50;
  return {
    p10:p50-lowerDistance*adjustment.radiusMultiplier,
    p50,
    p90:p50+upperDistance*adjustment.radiusMultiplier,
    confidence:adjustment.confidenceMultiplier
  };
}
