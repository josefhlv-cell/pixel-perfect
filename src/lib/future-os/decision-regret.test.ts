import { describe, expect, it } from "vitest";
import { decisionRegret, strategyRegret } from "./decision-regret";

describe("Decision regret", () => {
  it("compares the chosen action with the best realized alternative", () => {
    expect(decisionRegret(
      { action: "BUY", expectedUtility: 8, realizedUtility: 5 },
      [
        { action: "WAIT", expectedUtility: 4, realizedUtility: 10 },
        { action: "PASS", expectedUtility: 2, realizedUtility: 7 },
      ],
    )).toBe(5);
  });

  it("aggregates regret across historical decisions", () => {
    const result = strategyRegret([
      {
        chosen: { action: "BUY", expectedUtility: 8, realizedUtility: 5 },
        alternatives: [{ action: "WAIT", expectedUtility: 4, realizedUtility: 10 }],
      },
      {
        chosen: { action: "WAIT", expectedUtility: 4, realizedUtility: 4 },
        alternatives: [{ action: "PASS", expectedUtility: 2, realizedUtility: 4 }],
      },
    ]);
    expect(result.meanRegret).toBe(2.5);
    expect(result.regretRate).toBe(0.5);
  });
});
