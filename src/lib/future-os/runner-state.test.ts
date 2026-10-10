import { describe, expect, it } from "vitest";
import { assertRevealState, transitionRunner } from "./runner-state";

describe("runner state machine", () => {
  it("permits reveal only after prediction commit", () => {
    expect(() => assertRevealState("PREDICTING")).toThrow();
    expect(() => assertRevealState("PREDICTION_COMMITTED")).not.toThrow();
  });

  it("follows the preregistered prediction/reveal ordering", () => {
    let state = "INIT" as const;
    state = transitionRunner(state, "FIT_COMPLETE");
    state = transitionRunner(state, "PREDICTION_CREATED");
    state = transitionRunner(state, "PREDICTION_COMMITTED");
    expect(state).toBe("PREDICTION_COMMITTED");
    state = transitionRunner(state, "REALIZATION_REVEALED");
    expect(state).toBe("REVEALING");
    state = transitionRunner(state, "SCORE_COMPLETE");
    expect(state).toBe("SCORING");
  });

  it("rejects a future result being used before commit", () => {
    expect(() =>
      transitionRunner("PREDICTING", "REALIZATION_REVEALED"),
    ).toThrow();
  });
});
