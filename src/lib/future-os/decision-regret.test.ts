import { describe, expect, it } from "vitest";
import { strategyRegret } from "./decision-regret";

describe("Decision regret", () => {
  it("quantifies downside of choosing a worse action", () => {
    const result = strategyRegret([
      { action: "BUY", expectedUtility: 8, realizedUtility: 5 },
      { action: "WAIT", expectedUtility: 4, realizedUtility: 10 },
    ]);
    expect(result.meanRegret).toBeGreaterThan(0);
    expect(result.regretRate).toBe(0.5);
  });
});
