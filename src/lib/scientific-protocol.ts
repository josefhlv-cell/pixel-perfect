/** Gate for forecasting claims: only out-of-sample, leakage-free, calibrated improvements over a baseline pass. */
export interface ScientificEvidence {
  model: string;
  baseline: string;
  horizonMonths: number;
  oosScore: number;
  baselineScore: number;
  improvementPct: number;
  calibrationError: number;
  intervalCoverage: number;
  leakageIssues: number;
  driftScore: number;
  sampleSize: number;
}

export type Verdict = "REJECTED" | "INSUFFICIENT" | "PROVISIONAL" | "SUPPORTED";

export function scientificVerdict(e: ScientificEvidence): { status: Verdict; reasons: string[] } {
  const reasons: string[] = [];
  if (e.leakageIssues > 0) reasons.push("look-ahead leakage detected");
  if (e.oosScore <= e.baselineScore) reasons.push("does not beat baseline out-of-sample");
  if (reasons.length) return { status: "REJECTED", reasons };
  if (e.sampleSize < 100) return { status: "INSUFFICIENT", reasons: ["sample too small"] };
  if (e.calibrationError > 0.1 || e.intervalCoverage < 0.7 || e.driftScore > 0.3)
    return { status: "PROVISIONAL", reasons: ["calibration/coverage/drift not yet adequate"] };
  return { status: "SUPPORTED", reasons: [] };
}
