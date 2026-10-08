import { PREREGISTERED_TRAJECTORY_GRAPH } from "./trajectory-graph";
import type { PreregisteredTrajectoryGraph } from "./trajectory-graph";

export type AttackId =
  | "A1_LEAVE_OUT_TOP_K"
  | "A2_ALTERNATIVE_MODELS"
  | "A3_LAG_GRID"
  | "A4_REGIME_REWRITE"
  | "A5_DATA_DEGRADATION"
  | "A6_PLAUSIBLE_SHOCKS";

export type AblationId =
  | "BASELINE"
  | "INFORMATION_ONLY"
  | "SURVIVAL_ONLY"
  | "SURVIVAL_INFORMATION"
  | "SURVIVAL_INFORMATION_TRAJECTORY"
  | "SECONDARY_TRAJECTORY_EXPLORATORY";

export type ExperimentConfig = {
  version: "0.1";
  horizonMonths: 12;
  embargoMonths: 12;
  epsilon: 0.1;
  delta: number;
  attacks: readonly AttackId[];
  minimumRegions: 10;
  minimumWalkForwardWindows: 20;
  blockBootstrapMonths: 12;
  scoreAlpha: 1;
  scoreBeta: 1;
  informationScaleSource: "TRAINING_ONLY";
  vintagePolicy: "STRICT" | "ASSUMED_LAGS_ALLOWED";
  noBottleneckSeparation: 0.05;
  noBottleneckUnresolvedShare: 0.5;
  trajectory: PreregisteredTrajectoryGraph;
  ablations: readonly AblationId[];
};

export const PREREGISTERED_ATTACKS: readonly AttackId[] = [
  "A1_LEAVE_OUT_TOP_K",
  "A2_ALTERNATIVE_MODELS",
  "A3_LAG_GRID",
  "A4_REGIME_REWRITE",
  "A5_DATA_DEGRADATION",
  "A6_PLAUSIBLE_SHOCKS",
] as const;

export const PREREGISTERED_ABLATIONS: readonly AblationId[] = [
  "BASELINE",
  "INFORMATION_ONLY",
  "SURVIVAL_ONLY",
  "SURVIVAL_INFORMATION",
  "SURVIVAL_INFORMATION_TRAJECTORY",
  "SECONDARY_TRAJECTORY_EXPLORATORY",
] as const;

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
  noBottleneckSeparation: 0.05,
  noBottleneckUnresolvedShare: 0.5,
  trajectory: PREREGISTERED_TRAJECTORY_GRAPH,
  ablations: PREREGISTERED_ABLATIONS,
};
