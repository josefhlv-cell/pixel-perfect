export type FutureStressDimension =
  | "DATA"
  | "MODEL"
  | "CAUSAL"
  | "REGIME"
  | "TEMPORAL"
  | "SPATIAL"
  | "SHOCK"
  | "BENCHMARK";

export const FUTURE_STRESS_DIMENSIONS: readonly FutureStressDimension[] = [
  "DATA", "MODEL", "CAUSAL", "REGIME", "TEMPORAL", "SPATIAL", "SHOCK", "BENCHMARK",
];

export type FutureStressTest = {
  dimension: FutureStressDimension;
  id: string;
  description: string;
  survived: boolean;
  lossRatio: number;
  confidence: number;
  evidence: string[];
};

export type FutureSurvivalInput = {
  candidateId: string;
  baselineScore: number;
  tests: FutureStressTest[];
  minimumConfidence?: number;
  minimumSurvivalRate?: number;
};

export type FutureSurvivalResult = {
  candidateId: string;
  survivalScore: number;
  survivalRate: number;
  confidence: number;
  status: "FRAGILE" | "SURVIVING" | "ROBUST" | "UNKNOWN";
  dimensions: Record<FutureStressDimension, {
    tests: number;
    usableTests: number;
    survived: number;
    survivalRate: number;
    averageLossRatio: number;
  }>;
  failedDimensions: FutureStressDimension[];
  missingDimensions: FutureStressDimension[];
  decisiveAttacks: string[];
};

/**
 * Falsification/robustness summary, not causal proof and not a substitute for
 * point-in-time backtesting. Low-confidence tests are reported but cannot
 * improve or degrade the score. Missing dimensions prevent a ROBUST label.
 */
export function evaluateFutureSurvival(input: FutureSurvivalInput): FutureSurvivalResult {
  const minimumConfidence = clamp(input.minimumConfidence ?? 0.55);
  const minimumSurvivalRate = clamp(input.minimumSurvivalRate ?? 0.6);
  const dimensions = emptyDimensions();

  for (const test of input.tests) {
    const dimension = dimensions[test.dimension];
    if (!dimension) continue;
    dimension.tests += 1;
    const usable = Number.isFinite(test.confidence) && test.confidence >= minimumConfidence;
    if (usable) {
      dimension.usableTests += 1;
      if (test.survived) dimension.survived += 1;
      dimension.averageLossRatio += clamp(test.lossRatio);
    }
  }

  for (const dimension of Object.values(dimensions)) {
    dimension.survivalRate = dimension.usableTests
      ? dimension.survived / dimension.usableTests
      : 0;
    dimension.averageLossRatio = dimension.usableTests
      ? dimension.averageLossRatio / dimension.usableTests
      : 0;
  }

  const usableTests = input.tests.filter(
    test => Number.isFinite(test.confidence) && test.confidence >= minimumConfidence,
  );
  const missingDimensions = FUTURE_STRESS_DIMENSIONS.filter(
    key => dimensions[key].usableTests === 0,
  );

  if (!usableTests.length) {
    return {
      candidateId: input.candidateId,
      survivalScore: 0,
      survivalRate: 0,
      confidence: 0,
      status: "UNKNOWN",
      dimensions,
      failedDimensions: [],
      missingDimensions,
      decisiveAttacks: [],
    };
  }

  const survivalRate = usableTests.filter(test => test.survived).length / usableTests.length;
  const severityAdjusted = usableTests.reduce(
    (sum, test) => sum + (test.survived ? 1 : 0) * (1 - 0.65 * clamp(test.lossRatio)),
    0,
  ) / usableTests.length;
  const baseline = clamp(input.baselineScore);
  const confidence = usableTests.reduce((sum, test) => sum + clamp(test.confidence), 0) / usableTests.length;

  // Only dimensions with at least one sufficiently credible test contribute.
  // Missing dimensions are tracked separately and block the ROBUST label.
  const dimensionRates = FUTURE_STRESS_DIMENSIONS
    .filter(key => dimensions[key].usableTests > 0)
    .map(key => dimensions[key].survivalRate);
  const harmonic = dimensionRates.length
    ? dimensionRates.length / dimensionRates.reduce((sum, rate) => sum + 1 / Math.max(rate, 0.05), 0)
    : 0;

  const survivalScore = clamp(
    0.2 * baseline + 0.3 * severityAdjusted + 0.3 * harmonic + 0.2 * confidence,
  );
  const failedDimensions = FUTURE_STRESS_DIMENSIONS.filter(
    key => dimensions[key].usableTests > 0 && dimensions[key].survivalRate < minimumSurvivalRate,
  );
  const decisiveAttacks = [...usableTests]
    .filter(test => !test.survived || clamp(test.lossRatio) >= 0.5)
    .sort((a, b) => clamp(b.lossRatio) - clamp(a.lossRatio))
    .slice(0, 5)
    .map(test => test.id);

  const status =
    missingDimensions.length === 0 &&
    failedDimensions.length === 0 &&
    survivalRate >= 0.8 &&
    harmonic >= 0.65 &&
    survivalScore >= 0.72
      ? "ROBUST"
      : survivalRate >= minimumSurvivalRate && survivalScore >= 0.5
        ? "SURVIVING"
        : "FRAGILE";

  return {
    candidateId: input.candidateId,
    survivalScore,
    survivalRate,
    confidence,
    status,
    dimensions,
    failedDimensions,
    missingDimensions,
    decisiveAttacks,
  };
}

function emptyDimensions(): FutureSurvivalResult["dimensions"] {
  return {
    DATA: emptyDimension(),
    MODEL: emptyDimension(),
    CAUSAL: emptyDimension(),
    REGIME: emptyDimension(),
    TEMPORAL: emptyDimension(),
    SPATIAL: emptyDimension(),
    SHOCK: emptyDimension(),
    BENCHMARK: emptyDimension(),
  };
}

function emptyDimension() {
  return {
    tests: 0,
    usableTests: 0,
    survived: 0,
    survivalRate: 0,
    averageLossRatio: 0,
  };
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}
