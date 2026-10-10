import { DEFAULT_EXPERIMENT_CONFIG, PREREGISTERED_ATTACKS } from "./experiment-config";
import { describe, expect, it } from "vitest";

describe("Experiment configuration", () => {
  it("locks attacks and trajectory aggregation", () => {
    expect(DEFAULT_EXPERIMENT_CONFIG.attacks).toEqual(PREREGISTERED_ATTACKS);
    expect(DEFAULT_EXPERIMENT_CONFIG.epsilon).toBe(0.1);
    expect(DEFAULT_EXPERIMENT_CONFIG.horizonMonths).toBe(12);
    expect(DEFAULT_EXPERIMENT_CONFIG.trajectory.pathSurvivalAggregation).toBe("GEOMETRIC_MEAN");
  });
});