import type { ExperimentConfig } from "./experiment-config";
import { hashExperimentConfig } from "./experiment-integrity";
import {
  PREREGISTERED_TRAJECTORY_GRAPH_HASH,
} from "./trajectory-graph";
import {
  assertPredictionRecordComplete,
  type PredictionRecord,
  type PredictionJournal,
} from "./prediction-journal";
import {
  assertRevealState,
  type RunnerState,
  transitionRunner,
} from "./runner-state";

export type WalkForwardCase = {
  experimentId: string;
  region: string;
  origin: string;
  horizonEnd: string;
  asOf: string;
  scenarioId: string;
  bottleneckEdgeId: string | null;
  bottleneckStatus: "IDENTIFIED" | "NO_BOTTLENECK";
  scenarioScore: number;
  realization?: never;
};

export type Realization = {
  value: number;
  direction: -1 | 0 | 1;
};

export type WalkForwardRunnerDeps = {
  config: ExperimentConfig;
  codeSha: string;
  dependencyLockHash: string;
  vintageSnapshotHash: string;
  seed: number;
  journal: PredictionJournal;
  buildCases: () => readonly WalkForwardCase[];
  loadRealization: (item: WalkForwardCase) => Promise<Realization>;
};

export type WalkForwardResult = {
  cases: number;
  committedPredictions: number;
  revealedRealizations: number;
  state: RunnerState;
};

export async function runWalkForward(
  deps: WalkForwardRunnerDeps,
): Promise<WalkForwardResult> {
  const cases = deps.buildCases();
  const configHash = await hashExperimentConfig(deps.config);

  if (
    deps.config.trajectoryGraphHash !== PREREGISTERED_TRAJECTORY_GRAPH_HASH
  ) {
    throw new Error("Trajectory graph hash mismatch.");
  }

  for (const item of cases) {
    let state: RunnerState = "INIT";

    state = transitionRunner(state, "FIT_COMPLETE");
    state = transitionRunner(state, "PREDICTION_CREATED");

    const prediction: PredictionRecord = {
      experimentId: item.experimentId,
      configHash,
      codeSha: deps.codeSha,
      dependencyLockHash: deps.dependencyLockHash,
      vintageSnapshotHash: deps.vintageSnapshotHash,
      seed: deps.seed,
      origin: item.origin,
      region: item.region,
      asOf: item.asOf,
      horizonEnd: item.horizonEnd,
      scenarioId: item.scenarioId,
      bottleneckEdgeId: item.bottleneckEdgeId,
      bottleneckStatus: item.bottleneckStatus,
      scenarioScore: item.scenarioScore,
    };

    assertPredictionRecordComplete(prediction);
    const predictionRecordHash = await deps.journal.appendPrediction(prediction);
    state = transitionRunner(state, "PREDICTION_COMMITTED");

    assertRevealState(state);
    state = transitionRunner(state, "REALIZATION_REVEALED");

    // Physical reveal boundary: this callback is not invoked until after
    // appendPrediction has committed the immutable prediction record.
    const realization = await deps.loadRealization(item);

    await deps.journal.appendRealization({
      experimentId: item.experimentId,
      predictionRecordHash,
      realizedAt: item.horizonEnd,
      targetValue: realization.value,
      targetDirection: realization.direction,
    });

    state = transitionRunner(state, "SCORE_COMPLETE");
    state = transitionRunner(state, "SCORE_COMPLETE");

    if (state !== "COMPLETE") {
      throw new Error("Walk-forward case did not reach COMPLETE state.");
    }
  }

  return {
    cases: cases.length,
    committedPredictions: cases.length,
    revealedRealizations: cases.length,
    state: cases.length ? "COMPLETE" : "INIT",
  };
}
