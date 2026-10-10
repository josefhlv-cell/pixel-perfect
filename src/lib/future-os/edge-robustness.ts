export type EdgeRobustnessComponents = {
  survival: number;
  evidence: number;
  association: number;
};

export type EdgeRobustness = EdgeRobustnessComponents & {
  score: number;
  normalization: "TRAINING_QUANTILE_0_1";
  supportStatus: "SUPPORTED" | "HYPOTHESIS";
};

function assertUnit(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be in [0, 1].`);
  }
}

export function computeEdgeRobustness(
  components: EdgeRobustnessComponents,
  supportStatus: "SUPPORTED" | "HYPOTHESIS",
): EdgeRobustness {
  assertUnit(components.survival, "survival");
  assertUnit(components.evidence, "evidence");
  assertUnit(components.association, "association");

  // Status is metadata only. It never changes the score.
  const score =
    components.survival *
    (0.5 * components.evidence + 0.5 * components.association);

  return {
    ...components,
    score,
    normalization: "TRAINING_QUANTILE_0_1",
    supportStatus,
  };
}
