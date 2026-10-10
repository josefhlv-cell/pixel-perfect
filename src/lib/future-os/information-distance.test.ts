import { describe, expect, it } from "vitest";
import { scenarioInformation, scoreScenario } from "./information-distance";

describe("Scenario information", () => {
  const baseline = { support: [0, 1, 2], probabilities: [0.2, 0.6, 0.2] } as const;

  it("gives near-baseline scenarios low information", () => {
    const result = scenarioInformation(
      { support: [0, 1, 2], probabilities: [0.2000001, 0.5999998, 0.2] },
      baseline,
      1,
      0.1,
    );
    expect(result.normalizedInformation).toBeLessThan(0.001);
    expect(result.adjustedInformation).toBeGreaterThanOrEqual(0.1);
    expect(result.adjustedInformation).toBeLessThan(0.101);
  });

  it("keeps information bounded even when KL is large", () => {
    const result = scenarioInformation(
      { support: [0, 1, 2], probabilities: [0.999999, 0.0000005, 0.0000005] },
      baseline,
      1,
      0.1,
    );
    expect(result.adjustedInformation).toBeGreaterThan(0.1);
    expect(result.adjustedInformation).toBeLessThanOrEqual(1);
  });

  it("uses the information term in the final scenario score", () => {
    expect(scoreScenario(0.8, 0.9, 0.1)).toBeCloseTo(0.072);
  });

  it("rejects a non-training scale", () => {
    expect(() => scenarioInformation(baseline, baseline, 0)).toThrow();
  });
});