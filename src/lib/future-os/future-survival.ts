export type FutureStressDimension =
  | "DATA"
  | "MODEL"
  | "CAUSAL"
  | "REGIME"
  | "TEMPORAL"
  | "SPATIAL"
  | "SHOCK"
  | "BENCHMARK";

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
    survived: number;
    survivalRate: number;
    averageLossRatio: number;
  }>;
  failedDimensions: FutureStressDimension[];
  decisiveAttacks: string[];
};

/**
 * Future Survival Engine
 *
 * A forecast is not trusted because it is the strongest forecast at baseline.
 * It is trusted only to the extent that it survives plausible attempts to
 * falsify it. This is a robustness layer, not a causal proof and not a
 * substitute for point-in-time backtesting.
 *
 * The important distinction is:
 * - probability asks "how plausible is this future?"
 * - survival asks "how much does this future depend on assumptions that can
 *   plausibly be broken?"
 */
export function evaluateFutureSurvival(
  input: FutureSurvivalInput,
): FutureSurvivalResult {
  const minimumConfidence = clamp(input.minimumConfidence ?? 0.55);
  const minimumSurvivalRate = clamp(input.minimumSurvivalRate ?? 0.6);
  const dimensions = emptyDimensions();

  for (const test of input.tests) {
    const dimension = dimensions[test.dimension];
    dimension.tests += 1;
    if (test.survived && test.confidence >= minimumConfidence) {
      dimension.survived += 1;
    }
    dimension.averageLossRatio += clamp(test.lossRatio);
  }

  for (const dimension of Object.values(dimensions)) {
    dimension.survivalRate = dimension.tests
      ? dimension.survived / dimension.tests
      : 0;
    dimension.averageLossRatio = dimension.tests
      ? dimension.averageLossRatio / dimension.tests
      : 0;
  }

  const usableTests = input.tests.filter(
    test => test.confidence >= minimumConfidence,
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
      decisiveAttacks: [],
    };
  }

  const survivalRate =
    usableTests.filter(test => test.survived).length / usableTests.length;

  // A candidate should not receive a high score merely by surviving many
  // easy attacks. Loss severity penalizes futures that technically survive
  // while their forecast magnitude collapses.
  const severityAdjusted =
    usableTests.reduce(
      (sum, test) =>
        sum +
        (test.survived ? 1 : 0) * (1 - 0.65 * clamp(test.lossRatio)),
      0,
    ) / usableTests.length;

  const baseline = clamp(input.baselineScore);
  const confidence =
    usableTests.reduce((sum, test) => sum + clamp(test.confidence), 0) /
    usableTests.length;

  // Geometric-style pressure: weak dimensions matter. The harmonic mean
  // prevents a candidate from hiding a catastrophic failure behind strong
  // performance elsewhere.
  const dimensionRates = Object.values(dimensions)
    .filter(d => d.tests > 0)
    .map(d => d.survivalRate);

  const harmonic =
    dimensionRates.length
      ? dimensionRates.length /
        dimensionRates.reduce((sum, rate) => sum + 1 / Math.max(rate, 0.05), 0)
      : 0;

  const survivalScore = clamp(
    0.2 * baseline +
      0.3 * severityAdjusted +
      0.3 * harmonic +
      0.2 * confidence,
  );

  const failedDimensions = (Object.keys(dimensions) as FutureStressDimension[])
    .filter(d => dimensions[d].tests > 0 && dimensions[d].survivalRate < minimumSurvivalRate);

  const decisiveAttacks = [...usableTests]
    .filter(test => !test.survived || test.lossRatio >= 0.5)
    .sort((a, b) => b.lossRatio - a.lossRatio)
    .slice(0, 5)
    .map(test => test.id);

  const status =
    survivalRate >= 0.8 &&
    harmonic >= 0.65 &&
    survivalScore >= 0.72
      ? "ROBUST"
      : survivalRate >= minimumSurvivalRate &&
          survivalScore >= 0.5
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
    survived: 0,
    survivalRate: 0,
    averageLossRatio: 0,
  };
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}
