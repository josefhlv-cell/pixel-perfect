import { describe, expect, it } from "vitest";
import { analyzeForecastDistribution } from "./distribution";

describe("Future OS distribution analysis", () => {
  it("distinguishes broad-based outcomes from a heterogeneous distribution", () => {
    expect(analyzeForecastDistribution([2, 2.5, 3, 3.2, 3.5]).interpretation).toBe("BROAD_BASED");
    expect(analyzeForecastDistribution([-8, -4, 1, 8, 12]).interpretation).toBe("HETEROGENEOUS");
  });

  it("does not equate the mean with the market-wide median", () => {
    const result = analyzeForecastDistribution([-10, 2, 2, 3, 3]);
    expect(result.mean).not.toBe(result.median);
  });
});
