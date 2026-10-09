import { describe, expect, it } from "vitest";
import { explainCounterfactual } from "./counterfactual";

describe("Counterfactual explanation", () => {
  it("ranks the largest drivers first", () => {
    const result = explainCounterfactual(
      { rates: 6, supply: 12, liquidity: 0.5 },
      { rates: 4, supply: 10, liquidity: 0.8 },
    );
    expect(result[0].key).toBe("rates");
    expect(result.reduce((s, x) => s + x.contribution, 0)).toBeCloseTo(1);
  });
});
