export type PowerDesign = {
  origins: number;
  regions: number;
  identifiedBottleneckRate: number;
  alpha: number;
  minimumDetectableEffect: number;
  outcomeStdDev: number;
  designEffect: number;
};

export type PowerEstimate = {
  eligibleCases: number;
  effectiveCases: number;
  approximateStandardError: number;
  detectableEffect: number;
  decisionStatus: "PLANNING_ONLY" | "UNRESOLVED_SMALL_SAMPLE";
};

export const MIN_EFFECTIVE_CASES_FOR_H2_DECISION = 50;

function assertProbability(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be in [0,1].`);
  }
}

/**
 * Conservative planning approximation only. Final inference uses the
 * preregistered block bootstrap on actual outcomes.
 */
export function estimateH2Power(design: PowerDesign): PowerEstimate {
  if (!Number.isInteger(design.origins) || design.origins < 1) {
    throw new Error("origins must be a positive integer.");
  }
  if (!Number.isInteger(design.regions) || design.regions < 1) {
    throw new Error("regions must be a positive integer.");
  }
  assertProbability(design.identifiedBottleneckRate, "identifiedBottleneckRate");
  if (design.outcomeStdDev <= 0 || !Number.isFinite(design.outcomeStdDev)) {
    throw new Error("outcomeStdDev must be positive.");
  }
  if (design.designEffect < 1 || !Number.isFinite(design.designEffect)) {
    throw new Error("designEffect must be >= 1.");
  }
  if (design.alpha <= 0 || design.alpha >= 1) {
    throw new Error("alpha must be in (0,1).");
  }

  const eligibleCases = design.origins * design.regions;
  const effectiveCases = (eligibleCases * design.identifiedBottleneckRate) / design.designEffect;
  const approximateStandardError =
    effectiveCases > 0
      ? design.outcomeStdDev * Math.sqrt(2 / effectiveCases)
      : Number.POSITIVE_INFINITY;
  const zAlpha = 1.96;
  const detectableEffect = Math.max(
    design.minimumDetectableEffect,
    zAlpha * approximateStandardError,
  );

  return {
    eligibleCases,
    effectiveCases,
    approximateStandardError,
    detectableEffect,
    decisionStatus:
      effectiveCases >= MIN_EFFECTIVE_CASES_FOR_H2_DECISION
        ? "PLANNING_ONLY"
        : "UNRESOLVED_SMALL_SAMPLE",
  };
}
