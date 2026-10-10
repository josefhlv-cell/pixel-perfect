export type PredictiveDistribution = {
  support: readonly number[];
  probabilities: readonly number[];
};

export type InformationDistanceResult = {
  kl: number;
  normalizedInformation: number;
  adjustedInformation: number;
  epsilon: number;
  scale: number;
};

export function klDivergence(
  scenario: PredictiveDistribution,
  baseline: PredictiveDistribution,
  probabilityFloor = 1e-12,
): number {
  assertCompatible(scenario, baseline);

  let divergence = 0;
  for (let i = 0; i < scenario.probabilities.length; i += 1) {
    const p = Math.max(probabilityFloor, scenario.probabilities[i] ?? 0);
    const q = Math.max(probabilityFloor, baseline.probabilities[i] ?? 0);
    divergence += p * Math.log(p / q);
  }
  return Math.max(0, divergence);
}

/**
 * Information is deliberately not defined as 1 - KL: KL is unbounded.
 * A fixed scale is learned on training data only and then frozen for test data.
 */
export function scenarioInformation(
  scenario: PredictiveDistribution,
  baseline: PredictiveDistribution,
  scale: number,
  epsilon = 0.1,
): InformationDistanceResult {
  if (!(scale > 0) || !Number.isFinite(scale)) {
    throw new Error("Information scale must be a positive finite training-only constant.");
  }
  if (!(epsilon >= 0 && epsilon < 1)) {
    throw new Error("epsilon must satisfy 0 <= epsilon < 1.");
  }

  const kl = klDivergence(scenario, baseline);
  const normalizedInformation = kl / (kl + scale);
  const adjustedInformation = epsilon + (1 - epsilon) * normalizedInformation;

  return { kl, normalizedInformation, adjustedInformation, epsilon, scale };
}

function assertCompatible(
  a: PredictiveDistribution,
  b: PredictiveDistribution,
): void {
  if (a.support.length !== a.probabilities.length || b.support.length !== b.probabilities.length) {
    throw new Error("Distribution support/probability lengths must match.");
  }
  if (a.support.length !== b.support.length || a.support.some((v, i) => v !== b.support[i])) {
    throw new Error("Scenario and baseline distributions must share identical support.");
  }

  for (const distribution of [a, b]) {
    const sum = distribution.probabilities.reduce((s, p) => s + p, 0);
    if (distribution.probabilities.some((p) => p < 0 || !Number.isFinite(p))) {
      throw new Error("Probabilities must be finite and non-negative.");
    }
    if (Math.abs(sum - 1) > 1e-8) {
      throw new Error("Probabilities must sum to 1.");
    }
  }
}

export function scoreScenario(
  probability: number,
  stressScore: number,
  adjustedInformation: number,
  alpha = 1,
  beta = 1,
): number {
  if (![probability, stressScore, adjustedInformation].every((v) => v >= 0 && v <= 1 && Number.isFinite(v))) {
    throw new Error("Scenario score inputs must be finite values in [0,1].");
  }
  if (!(alpha > 0 && beta > 0)) throw new Error("alpha and beta must be positive.");
  return probability ** alpha * stressScore ** beta * adjustedInformation;
}