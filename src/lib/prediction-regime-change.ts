/**
 * Reality Investor — Regime Change Detector.
 *
 * Purpose:
 * Detect whether the data-generating process of a property market is changing,
 * rather than merely extrapolating the current trend.
 *
 * This is a statistical change detector, not a trained causal model. A positive
 * signal means "the current regime looks different from the reference regime";
 * it does not identify the cause by itself.
 */

export type RegimeChangeDirection = "UPSHIFT" | "DOWNSHIFT" | "VOLATILITY_SHIFT" | "MIXED" | "NONE";

export interface RegimeObservation {
  at: string;
  features: Record<string, number | null | undefined>;
}

export interface RegimeFeatureSignal {
  feature: string;
  baselineMean: number;
  recentMean: number;
  standardizedShift: number;
  varianceRatio: number;
  cusum: number;
  direction: "UP" | "DOWN" | "VOLATILITY" | "STABLE";
  evidence: number;
}

export interface RegimeChangeResult {
  detected: boolean;
  changeScore: number;
  breakProbability: number;
  direction: RegimeChangeDirection;
  featureSignals: RegimeFeatureSignal[];
  changedFeatures: string[];
  persistence: number;
  baselineSize: number;
  recentSize: number;
  limitations: string[];
}

const EPS = 1e-9;

function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function variance(values: number[], center = mean(values)): number {
  if (values.length < 2) return 0;
  return values.reduce((sum, value) => sum + (value - center) ** 2, 0) / (values.length - 1);
}

function clamp(value: number, lo = 0, hi = 1): number {
  return Math.max(lo, Math.min(hi, value));
}

function robustScale(values: number[]): number {
  if (values.length < 3) return Math.sqrt(variance(values)) || 1;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor((sorted.length - 1) * 0.25)];
  const q3 = sorted[Math.floor((sorted.length - 1) * 0.75)];
  const iqr = q3 - q1;
  return Math.max(iqr / 1.349, Math.sqrt(variance(values)), 1e-6);
}

/**
 * One-sided Page-Hinkley/CUSUM-style accumulation.
 * Positive values accumulate upward shifts, negative values downward shifts.
 */
function signedCusum(values: number[], baselineMean: number, scale: number): number {
  let pos = 0;
  let neg = 0;
  for (const value of values) {
    const z = (value - baselineMean) / Math.max(scale, EPS);
    pos = Math.max(0, pos + z - 0.25);
    neg = Math.min(0, neg + z + 0.25);
  }
  return pos + neg;
}

function featureSignal(feature: string, baseline: number[], recent: number[]): RegimeFeatureSignal {
  const baselineMean = mean(baseline);
  const recentMean = mean(recent);
  const scale = robustScale(baseline);
  const standardizedShift = (recentMean - baselineMean) / Math.max(scale, EPS);
  const varianceRatio = (variance(recent) + EPS) / (variance(baseline) + EPS);
  const cusum = signedCusum(recent, baselineMean, scale);

  const shiftEvidence = clamp(Math.abs(standardizedShift) / 3);
  const varianceEvidence = clamp(Math.abs(Math.log(varianceRatio)) / Math.log(4));
  const cusumEvidence = clamp(Math.abs(cusum) / Math.max(recent.length * 0.8, 1));
  const evidence = clamp(0.55 * shiftEvidence + 0.25 * varianceEvidence + 0.20 * cusumEvidence);

  let direction: RegimeFeatureSignal["direction"] = "STABLE";
  if (varianceEvidence > 0.72 && shiftEvidence < 0.55) direction = "VOLATILITY";
  else if (standardizedShift > 0.75) direction = "UP";
  else if (standardizedShift < -0.75) direction = "DOWN";

  return {
    feature,
    baselineMean,
    recentMean,
    standardizedShift,
    varianceRatio,
    cusum,
    direction,
    evidence,
  };
}

export function detectRegimeChange(
  observations: RegimeObservation[],
  options: {
    baselineWindow?: number;
    recentWindow?: number;
    threshold?: number;
    minEvidenceFeatures?: number;
  } = {},
): RegimeChangeResult {
  const baselineWindow = Math.max(6, options.baselineWindow ?? 18);
  const recentWindow = Math.max(3, options.recentWindow ?? 6);
  const threshold = clamp(options.threshold ?? 0.62, 0.4, 0.95);
  const minEvidenceFeatures = Math.max(1, options.minEvidenceFeatures ?? 2);

  const ordered = [...observations].sort((a, b) => a.at.localeCompare(b.at));
  const baselineObs = ordered.slice(-(baselineWindow + recentWindow), -recentWindow);
  const recentObs = ordered.slice(-recentWindow);

  if (baselineObs.length < Math.min(baselineWindow, 6) || recentObs.length < 3) {
    return {
      detected: false,
      changeScore: 0,
      breakProbability: 0,
      direction: "NONE",
      featureSignals: [],
      changedFeatures: [],
      persistence: 0,
      baselineSize: baselineObs.length,
      recentSize: recentObs.length,
      limitations: ["Insufficient sequential observations for regime-change detection."],
    };
  }

  const featureNames = [...new Set(
    [...baselineObs, ...recentObs].flatMap(observation => Object.keys(observation.features)),
  )];

  const signals = featureNames
    .map(feature => {
      const baseline = baselineObs
        .map(observation => observation.features[feature])
        .filter((value): value is number => Number.isFinite(value));
      const recent = recentObs
        .map(observation => observation.features[feature])
        .filter((value): value is number => Number.isFinite(value));
      if (baseline.length < 5 || recent.length < 3) return null;
      return featureSignal(feature, baseline, recent);
    })
    .filter((signal): signal is RegimeFeatureSignal => signal !== null)
    .sort((a, b) => b.evidence - a.evidence);

  const changed = signals.filter(signal => signal.evidence >= 0.55);
  const meanEvidence = changed.length
    ? mean(changed.map(signal => signal.evidence))
    : 0;
  const breadth = clamp(changed.length / Math.max(minEvidenceFeatures, signals.length));
  const changeScore = clamp(0.72 * meanEvidence + 0.28 * breadth);

  const directional = changed.filter(signal => signal.direction === "UP" || signal.direction === "DOWN");
  const up = directional.filter(signal => signal.direction === "UP")
    .reduce((sum, signal) => sum + signal.evidence, 0);
  const down = directional.filter(signal => signal.direction === "DOWN")
    .reduce((sum, signal) => sum + signal.evidence, 0);
  const volatility = changed
    .filter(signal => signal.direction === "VOLATILITY")
    .reduce((sum, signal) => sum + signal.evidence, 0);

  let direction: RegimeChangeDirection = "NONE";
  if (volatility > Math.max(up, down) * 1.15 && volatility > 0.7) direction = "VOLATILITY_SHIFT";
  else if (up > 1.25 * Math.max(down, EPS)) direction = "UPSHIFT";
  else if (down > 1.25 * Math.max(up, EPS)) direction = "DOWNSHIFT";
  else if (changed.length) direction = "MIXED";

  // Convert evidence into a probability-like score, not a formally calibrated probability.
  // Calibration must be learned from realized regime labels/backtests before production use.
  const breakProbability = clamp(
    0.15 + 0.85 * (1 - Math.exp(-2.2 * changeScore)),
  );

  const tail = recentObs.slice(Math.max(0, recentObs.length - Math.min(3, recentObs.length)));
  const persistence = tail.length
    ? clamp(tail.length / 3 * (changed.length ? meanEvidence : 0))
    : 0;

  return {
    detected: changeScore >= threshold && changed.length >= minEvidenceFeatures,
    changeScore,
    breakProbability,
    direction,
    featureSignals: signals,
    changedFeatures: changed.map(signal => signal.feature),
    persistence,
    baselineSize: baselineObs.length,
    recentSize: recentObs.length,
    limitations: [
      "Break probability is an evidence score until calibrated against labelled regime transitions.",
      "The detector identifies distributional change; it does not prove causality.",
      "Sequential observations must be point-in-time correct to avoid look-ahead bias.",
    ],
  };
}
