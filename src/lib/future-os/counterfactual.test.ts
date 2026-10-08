import { describe, expect, it } from "vitest";
import { runCounterfactual } from "./counterfactual";

describe("Future OS counterfactual engine", () => {
  it("propagates a rate shock through an explicit causal chain", () => {
    const result = runCounterfactual(
      { rates: 3, mortgage_cost: 4, demand: 100, price: 100 },
      [{ key: "rates", delta: 1 }],
      [
        { sourceKey: "rates", targetKey: "mortgage_cost", expectedSign: 1, lagDays: 30, strength: 1, confidence: 0.9 },
        { sourceKey: "mortgage_cost", targetKey: "demand", expectedSign: -1, lagDays: 90, strength: 0.5, confidence: 0.8 },
        { sourceKey: "demand", targetKey: "price", expectedSign: 1, lagDays: 180, strength: 0.4, confidence: 0.8 },
      ],
    );
    expect(result.shocked.mortgage_cost).toBeGreaterThan(result.baseline.mortgage_cost);
    expect(result.shocked.demand).toBeLessThan(result.baseline.demand);
    expect(result.shocked.price).toBeLessThan(result.baseline.price);
  });

  it("does not invent effects without causal edges", () => {
    const result = runCounterfactual({ rates: 3, price: 100 }, [{ key: "rates", delta: 2 }], []);
    expect(result.shocked.price).toBe(100);
    expect(result.confidence).toBe(0);
  });
});
