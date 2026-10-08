import { describe, expect, it } from "vitest";
import { convergenceWarningLevel, detectFutureConvergence } from "./future-convergence";

describe("future convergence", () => {
  it("finds independent paths converging on the same future", () => {
    const result = detectFutureConvergence(
      "price",
      [
        { from: "rates", to: "credit", sign: -1, strength: .9, lagDays: 30, independenceGroup: "monetary" },
        { from: "credit", to: "price", sign: -1, strength: .9, lagDays: 60, independenceGroup: "monetary" },
        { from: "migration", to: "demand", sign: 1, strength: .8, lagDays: 20, independenceGroup: "demography" },
        { from: "demand", to: "price", sign: 1, strength: .8, lagDays: 50, independenceGroup: "demography" },
        { from: "inventory", to: "price", sign: -1, strength: .8, lagDays: 40, independenceGroup: "supply" },
      ],
      [
        { node: "rates", value: 1, reliability: .95, independenceGroup: "monetary" },
        { node: "migration", value: 1, reliability: .95, independenceGroup: "demography" },
        { node: "inventory", value: 1, reliability: .9, independenceGroup: "supply" },
      ],
    );
    const falling = result.find(r => r.direction === -1);
    const rising = result.find(r => r.direction === 1);
    expect(falling?.independentPathCount).toBeGreaterThanOrEqual(2);
    expect(rising?.independentPathCount).toBe(1);
    expect(falling && convergenceWarningLevel(falling)).toBe("EARLY_WARNING");
  });
});
