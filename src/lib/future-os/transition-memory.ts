export type TransitionTrajectory = {
  id: string;
  regime: string;
  onsetAt: string;
  features: Record<string, number[]>;
};

export type SurrogateWarningInput = {
  current: Record<string, number[]>;
  historicalTransitions: TransitionTrajectory[];
  neutralWindows?: number;
  transitionWindows?: number;
};

export type SurrogateWarning = {
  probability: number;
  nearestTransitionIds: string[];
  featureAgreement: number;
  status: "NO_SIGNAL" | "WATCH" | "EARLY_WARNING";
};

/**
 * Memory-of-transitions detector.
 *
 * Rather than assuming every market transition has the same mathematical
 * signature, compare the current multivariate trajectory with trajectories
 * observed before historical regime changes. This is a lightweight,
 * interpretable precursor layer; the production version should generate
 * surrogates only inside point-in-time training folds to prevent leakage.
 */
export function scoreTransitionSimilarity(input: SurrogateWarningInput): SurrogateWarning {
  if (!input.historicalTransitions.length) {
    return { probability: 0, nearestTransitionIds: [], featureAgreement: 0, status: "NO_SIGNAL" };
  }

  const candidates = input.historicalTransitions
    .map(transition => {
      const distances: number[] = [];
      for (const [key, currentSeries] of Object.entries(input.current)) {
        const historical = transition.features[key];
        if (!historical?.length || !currentSeries.length) continue;
        distances.push(normalizedTrajectoryDistance(currentSeries, historical));
      }
      const distance = distances.length
        ? distances.reduce((a, b) => a + b, 0) / distances.length
        : Infinity;
      return { id: transition.id, distance };
    })
    .filter(x => Number.isFinite(x.distance))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5);

  if (!candidates.length) {
    return { probability: 0, nearestTransitionIds: [], featureAgreement: 0, status: "NO_SIGNAL" };
  }

  const similarities = candidates.map(x => Math.exp(-x.distance));
  const probability = Math.min(
    0.99,
    similarities.reduce((a, b) => a + b, 0) / similarities.length,
  );
  const featureAgreement = Math.min(1, similarities.filter(x => x >= 0.6).length / 3);

  return {
    probability,
    nearestTransitionIds: candidates.map(x => x.id),
    featureAgreement,
    status:
      probability >= 0.72 && featureAgreement >= 0.66
        ? "EARLY_WARNING"
        : probability >= 0.48
          ? "WATCH"
          : "NO_SIGNAL",
  };
}

function normalizedTrajectoryDistance(a: number[], b: number[]) {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 1;

  const aa = zNormalize(a.slice(-n));
  const bb = zNormalize(b.slice(-n));
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const delta = aa[i] - bb[i];
    sum += delta * delta;
  }
  return Math.sqrt(sum / n);
}

function zNormalize(values: number[]) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, x) => s + (x - mean) ** 2, 0) / values.length;
  const sd = Math.sqrt(variance) || 1;
  return values.map(x => (x - mean) / sd);
}
