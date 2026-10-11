import { describe, expect, it } from "vitest";
import { convergenceWarningLevel, detectFutureConvergence } from "./future-convergence";

describe("future convergence", () => {
  it("finds independent paths converging on the same future", () => {
    const result = detectFutureConvergence(
      "price",
      [
        {
          from: "rates",
          to: "credit",
          sign: -1,
          strength: 0.9,
          lagDays: 30,
          independenceGroup: "monetary",
        },
        {
          from: "credit",
          to: "price",
          // Less credit → lower prices (positive co-movement). The previous
          // fixture used -1 here, which made higher rates *raise* prices.
          sign: 1,
          strength: 0.9,
          lagDays: 60,
          independenceGroup: "monetary",
        },
        {
          from: "migration",
          to: "demand",
          sign: 1,
          strength: 0.8,
          lagDays: 20,
          independenceGroup: "demography",
        },
        {
          from: "demand",
          to: "price",
          sign: 1,
          strength: 0.8,
          lagDays: 50,
          independenceGroup: "demography",
        },
        {
          from: "inventory",
          to: "price",
          sign: -1,
          strength: 0.8,
          lagDays: 40,
          independenceGroup: "supply",
        },
      ],
      [
        { node: "rates", value: 1, reliability: 0.95, independenceGroup: "monetary" },
        { node: "migration", value: 1, reliability: 0.95, independenceGroup: "demography" },
        { node: "inventory", value: 1, reliability: 0.9, independenceGroup: "supply" },
      ],
    );
    const falling = result.find((r) => r.direction === -1);
    const rising = result.find((r) => r.direction === 1);
    expect(falling?.independentPathCount).toBeGreaterThanOrEqual(2);
    expect(rising?.independentPathCount).toBe(1);
    expect(falling && convergenceWarningLevel(falling)).toBe("WATCH"); // 2 paths: EARLY_WARNING requires ≥3 independent paths
  });

  it("reverses direction for a falling precursor and ignores zero readings", () => {
    const edges = [
      {
        from: "inventory",
        to: "price",
        sign: -1 as const,
        strength: 0.8,
        lagDays: 40,
        independenceGroup: "supply",
      },
    ];
    const down = detectFutureConvergence("price", edges, [
      { node: "inventory", value: -1, reliability: 0.9, independenceGroup: "supply" },
    ]);
    expect(down[0]?.direction).toBe(1);
    expect(
      detectFutureConvergence("price", edges, [
        { node: "inventory", value: 0, reliability: 0.9, independenceGroup: "supply" },
      ]),
    ).toHaveLength(0);
  });
});
