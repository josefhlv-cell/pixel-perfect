import { describe, expect, it } from "vitest";
import { scoreOpportunity } from "./opportunity-radar";
describe("opportunity radar", () => {
  it("rewards asymmetric high-confidence opportunities", () => {
    const r = scoreOpportunity({
      id: "x",
      probabilityGain: 0.82,
      probabilityLargeGain: 0.48,
      probabilityLargeLoss: 0.06,
      expectedReturnBps: 1400,
      p10ReturnBps: -400,
      p50ReturnBps: 1200,
      p90ReturnBps: 3000,
      confidence: 0.86,
      agreement: 0.88,
      liquidity: 0.82,
      dataQuality: 0.9,
      negotiationPotential: 0.72,
    });
    expect(r.tier).toBe("EXCEPTIONAL");
  });
});
