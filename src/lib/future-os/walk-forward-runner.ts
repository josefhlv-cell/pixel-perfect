import type { ExperimentConfig } from "./experiment-config";
import { assertPredictionRecordComplete, type PredictionRecord, type PredictionJournal } from "./prediction-journal";
import { assertRevealState, type RunnerState, transitionRunner } from "./runner-state";

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
  realization: {
    value: number;
    direction: -1 | 0 | 1;
  };
};

export type WalkForwardResult = {
  cases: number;
  committedPredictions: number;
  revealedRealizations: number;
  state: RunnerState;
};

export type WalkForwardRunnerDeps = {
  config: ExperimentConfig;
  codeSha: string;
  dependencyLockHash: string;
  vintageSnapshotHash: string;
  seed: number;
  journal: PredictionJournal;
  buildCases: () => readonly WalkForwardCase[];
};

export async function runWalkForward(
  deps: WalkForwardRunnerDeps,
): Promise<WalkForwardResult> {
  const cases = deps.buildCases();
  let state: RunnerState = "INIT";
  state = transitionRunner(state, "FIT_COMPLETE");

  for (const item of cases) {
    state = transitionRunner(state, "PREDICTION_CREATED");

    const prediction: PredictionRecord = {
      experimentId: item.experimentId,
      configHash: JSON.stringify(deps.config),
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
    await deps.journal.appendPrediction(prediction);
    state = transitionRunner(state, "PREDICTION_COMMITTED");

    assertRevealState(state);
    state = transitionRunner(state, "REALIZATION_REVEALED");
    await deps.journal.appendRealization({
      experimentId: item.experimentId,
      predictionRecordHash: [
        item.experimentId,
        item.region,
        item.origin,
        item.asOf,
        item.scenarioId,
        item.bottleneckEdgeId ?? "NO_BOTTLENECK",
      ].join("|"),
      realizedAt: item.horizonEnd,
      targetValue: item.realization.value,
      targetDirection: item.realization.direction,
    });
    state = transitionRunner(state, "SCORE_COMPLETE");
    state = "PREDICTION_COMMITTED";
  }

  return {
    cases: cases.length,
    committedPredictions: cases.length,
    revealedRealizations: cases.length,
    state: cases.length ? "PREDICTION_COMMITTED" : "INIT",
  };
}
