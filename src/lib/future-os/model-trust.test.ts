import { describe, expect, it } from "vitest";
import { evaluateModelTrust } from "./model-trust";

describe("Future OS model trust", () => {
  it("demotes a champion when regime and forecast health break", () => {
    const result = evaluateModelTrust(
      [
        { key: "price", baseline: [1,1,1,1,1,1], recent: [5,7,9,8,10,11], threshold: 0.5 },
        { key: "liquidity", baseline: [1,1,1,1,1,1], recent: [5,6,8,9,10,12], threshold: 0.5 },
      ],
      Array.from({ length: 16 }, (_, i) => ({
        asOf: new Date(Date.UTC(2025, i, 1)).toISOString(),
        absoluteError: i < 8 ? 1 : 4,
        directionalHit: i < 8 || i % 3 === 0,
        intervalCovered: i < 8 || i % 2 === 0,
      })),
    );
    expect(["DEMOTE_CHAMPION", "RETRAIN"]).toContain(result.action);
    expect(result.trustScore).toBeLessThan(0.45);
  });
});
