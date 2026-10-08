export type RunnerState =
  | "INIT"
  | "FITTING"
  | "PREDICTING"
  | "COMMITTING_PREDICTION"
  | "PREDICTION_COMMITTED"
  | "REVEALING"
  | "SCORING"
  | "COMPLETE";

export type RunnerEvent =
  | "FIT_COMPLETE"
  | "PREDICTION_CREATED"
  | "PREDICTION_COMMITTED"
  | "REALIZATION_REVEALED"
  | "SCORE_COMPLETE";

const transitions: Record<RunnerState, Partial<Record<RunnerEvent, RunnerState>>> = {
  INIT: { FIT_COMPLETE: "FITTING" },
  FITTING: { PREDICTION_CREATED: "PREDICTING" },
  PREDICTING: { PREDICTION_COMMITTED: "PREDICTION_COMMITTED" },
  COMMITTING_PREDICTION: { PREDICTION_COMMITTED: "PREDICTION_COMMITTED" },
  PREDICTION_COMMITTED: { REALIZATION_REVEALED: "REVEALING" },
  REVEALING: { SCORE_COMPLETE: "SCORING" },
  SCORING: { SCORE_COMPLETE: "COMPLETE" },
  COMPLETE: {},
};

export function transitionRunner(
  state: RunnerState,
  event: RunnerEvent,
): RunnerState {
  const next = transitions[state][event];
  if (!next) {
    throw new Error(`Invalid runner transition: ${state} + ${event}`);
  }
  return next;
}

export function assertRevealState(state: RunnerState): void {
  if (state !== "PREDICTION_COMMITTED") {
    throw new Error(
      "Reveal is forbidden until the prediction has been committed.",
    );
  }
}
