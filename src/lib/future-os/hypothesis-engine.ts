export type Hypothesis = {
  key: string;
  prior: number;
  evidenceFor: number;
  evidenceAgainst: number;
  modelConfidence: number;
};

export type ObservationCandidate = {
  key: string;
  reliability: number;
  cost: number;
  latencyDays: number;
  discrimination: Record<string, number>;
};

export function updateHypothesisWeights(hypotheses: Hypothesis[]) {
  const weighted = hypotheses.map((h) => {
    const likelihoodRatio = Math.max(0.05, (1 + h.evidenceFor) / (1 + h.evidenceAgainst));
    return { ...h, score: h.prior * likelihoodRatio * Math.max(0, h.modelConfidence) };
  });
  const total = weighted.reduce((sum, h) => sum + h.score, 0);
  return weighted.map((h) => ({ ...h, posterior: total ? h.score / total : 0 }))
    .sort((a, b) => b.posterior - a.posterior);
}

export function nextBestObservation(
  hypotheses: Hypothesis[],
  candidates: ObservationCandidate[],
) {
  const posteriors = updateHypothesisWeights(hypotheses);
  return candidates.map((candidate) => {
    let discrimination = 0;
    for (let i = 0; i < posteriors.length; i++) {
      for (let j = i + 1; j < posteriors.length; j++) {
        const a = posteriors[i];
        const b = posteriors[j];
        const da = candidate.discrimination[a.key] ?? 0;
        const db = candidate.discrimination[b.key] ?? 0;
        discrimination += a.posterior * b.posterior * Math.abs(da - db);
      }
    }
    const utility = discrimination * candidate.reliability /
      Math.max(1, candidate.cost) /
      Math.max(1, Math.sqrt(1 + candidate.latencyDays));
    return { ...candidate, expectedInformationValue: utility };
  }).sort((a, b) => b.expectedInformationValue - a.expectedInformationValue);
}
