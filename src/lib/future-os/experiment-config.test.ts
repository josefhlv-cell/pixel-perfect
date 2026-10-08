import { describe, expect, it } from "vitest";
import { DEFAULT_EXPERIMENT_CONFIG, PREREGISTERED_ATTACKS } from "./experiment-config";

describe("Experiment configuration", () => {
  it("locks the preregistered attack catalog", () => {
    expect(DEFAULT_EXPERIMENT_CONFIG.attacks).toEqual(PREREGISTERED_ATTACKS);
    expect(DEFAULT_EXPERIMENT_CONFIG.epsilon).toBe(0.1);
    expect(DEFAULT_EXPERIMENT_CONFIG.horizonMonths).toBe(12);
  });
});