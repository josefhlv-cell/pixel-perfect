export type AttackId =
  | "A1_LEAVE_OUT_TOP_K"
  | "A2_ALTERNATIVE_MODELS"
  | "A3_LAG_GRID"
  | "A4_REGIME_REWRITE"
  | "A5_DATA_DEGRADATION"
  | "A6_PLAUSIBLE_SHOCKS";

export type PathSurvivalAggregation = "GEOMETRIC_MEAN";

export type PreregisteredTrajectoryGraph = {
  nodeIds: readonly string[];
  edgeIds: readonly string[];
  pathSurvivalAggregation: PathSurvivalAggregation;
};

export type ExperimentConfig = {
  version: "0.1";
  horizonMonths: 12;
  embargoMonths: 12;
  epsilon: 0.1;
  delta: number;
  attacks: readonly AttackId[];
  minimumRegions: 10;
  minimumWalkForwardWindows: number;
  blockBootstrapMonths: 12;
  scoreAlpha: number;
  scoreBeta: number;
  informationScaleSource: "TRAINING_ONLY";
  vintagePolicy: "STRICT" | "ASSUMED_LAGS_ALLOWED";
  trajectory: PreregisteredTrajectoryGraph;
};

export const PREREGISTERED_ATTACKS: readonly AttackId[] = [
  "A1_LEAVE_OUT_TOP_K",
  "A2_ALTERNATIVE_MODELS",
  "A3_LAG_GRID",
  "A4_REGIME_REWRITE",
  "A5_DATA_DEGRADATION",
  "A6_PLAUSIBLE_SHOCKS",
] as const;

/**
 * Placeholder graph identity for the experiment kernel.
 * Production experiments must replace this with a fixed, versioned graph
 * before any walk-forward evaluation. An empty graph is intentionally not
 * treated as evidence for H2.
 */
export const PREREGISTERED_TRAJECTORY_GRAPH: PreregisteredTrajectoryGraph = {
  nodeIds: [],
  edgeIds: [],
  pathSurvivalAggregation: "GEOMETRIC_MEAN",
};

export const DEFAULT_EXPERIMENT_CONFIG: ExperimentConfig = {
  version: "0.1",
  horizonMonths: 12,
  embargoMonths: 12,
  epsilon: 0.1,
  delta: 0.2,
  attacks: PREREGISTERED_ATTACKS,
  minimumRegions: 10,
  minimumWalkForwardWindows: 20,
  blockBootstrapMonths: 12,
  scoreAlpha: 1,
  scoreBeta: 1,
  informationScaleSource: "TRAINING_ONLY",
  vintagePolicy: "STRICT",
  trajectory: PREREGISTERED_TRAJECTORY_GRAPH,
};
