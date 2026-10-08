import { describe, expect, it } from "vitest";
import { estimateH2Power } from "./h2-power";

describe("H2 power planning", () => {
  it("reports effective cases after bottleneck identification and dependence penalty", () => {
    const result = estimateH2Power({
      origins: 40,
      regions: 10,
      identifiedBottleneckRate: 0.5,
      alpha: 0.05,
      minimumDetectableEffect: 0.1,
      outcomeStdDev: 0.25,
      designEffect: 2,
    });
    expect(result.eligibleCases).toBe(400);
    expect(result.effectiveCases).toBe(100);
    expect(result.detectableEffect).toBeGreaterThan(0);
  });

  it("rejects impossible identification rates", () => {
    expect(() =>
      estimateH2Power({
        origins: 10,
        regions: 10,
        identifiedBottleneckRate: 1.2,
        alpha: 0.05,
        minimumDetectableEffect: 0.1,
        outcomeStdDev: 0.2,
        designEffect: 1,
      }),
    ).toThrow();
  });
});
