import { describe, expect, it } from "vitest";
import { prioritizeResearch } from "./research-loop";

describe("Autonomous research loop", () => {
  it("prioritizes the highest information-value research action", () => {
    const result = prioritizeResearch({
      uncertainty: 0.9,
      dataQuality: 0.3,
      modelDisagreement: 0.8,
      regimeRisk: 0.2,
      unresolvedHypotheses: 3,
    });
    expect(result[0]!.action).toBe("COLLECT_DATA");
    expect(result[0]!.expectedValue).toBeGreaterThan(0.5);
  });

  it("raises falsification when regime risk dominates", () => {
    const result = prioritizeResearch({
      uncertainty: 0.9,
      dataQuality: 0.9,
      modelDisagreement: 0.2,
      regimeRisk: 0.95,
      unresolvedHypotheses: 1,
    });
    expect(result[0]!.action).toBe("FALSIFY");
  });
});
