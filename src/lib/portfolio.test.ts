import { describe, expect, it } from "vitest";
import { portfolioSeries, portfolioTotals } from "./portfolio";

describe("empty portfolio observations", () => {
  it("returns unknown amounts instead of zero for an empty portfolio", () => {
    expect(portfolioTotals([], [])).toEqual({
      value: null,
      debt: null,
      equity: null,
      rent: null,
      cashFlow: null,
      appreciation: null,
      yieldBps: null,
      count: 0,
    });
    expect(portfolioSeries([], [], "ALL")).toEqual([]);
  });
});
