import { describe, expect, it } from "vitest";
import { detectDrift, detectRegimeBreak } from "./drift";

describe("Future OS drift detection", () => {
  it("flags a meaningful change in level and volatility", () => {
    const result = detectDrift({
      key: "liquidity",
      baseline: [100, 101, 99, 100, 102, 98, 101, 100],
      recent: [120, 130, 125, 140, 135, 145, 150, 142],
      threshold: 2,
    });
    expect(result.status).toBe("BREAK");
    expect(result.driftScore).toBeGreaterThan(0.7);
  });

  it("does not call a stable series a regime break", () => {
    const result = detectRegimeBreak([
      { key: "price", baseline: [100, 101, 99, 100, 102], recent: [101, 100, 102, 101, 103], threshold: 2 },
      { key: "dom", baseline: [30, 31, 29, 30, 32], recent: [31, 30, 32, 31, 30], threshold: 2 },
    ]);
    expect(result.regime).toBe("STABLE");
  });
});
