import { describe, expect, it } from "vitest";
import { evaluateForecastHealth } from "./forecast-health";

describe("Future OS forecast health", () => {
  it("detects a model whose recent errors deteriorate", () => {
    const history = [
      ...Array.from({ length: 12 }, (_, i) => ({ asOf: `2025-0${Math.min(i + 1, 9)}-01T00:00:00Z`, absoluteError: 1, directionalHit: true, intervalCovered: true })),
      ...Array.from({ length: 8 }, (_, i) => ({ asOf: `2026-0${i + 1}-01T00:00:00Z`, absoluteError: 3, directionalHit: i % 3 !== 0, intervalCovered: i % 2 === 0 })),
    ];
    const result = evaluateForecastHealth(history, 8);
    expect(result.status).toBe("BROKEN");
    expect(result.maeRatio).toBeGreaterThan(1.75);
  });

  it("does not label empty history as healthy", () => {
    const result = evaluateForecastHealth([]);
    expect(result.status).toBe("INSUFFICIENT_DATA");
    expect(result.sampleCount).toBe(0);
  });

  it("requires a historical comparator and enough recent outcomes", () => {
    const history = Array.from({ length: 7 }, (_, i) => ({
      asOf: new Date(Date.UTC(2025, i, 1)).toISOString(),
      absoluteError: 0,
      directionalHit: true,
      intervalCovered: true,
    }));
    expect(evaluateForecastHealth(history, 4).status).toBe("INSUFFICIENT_DATA");
  });

  it("ignores malformed outcomes rather than counting them as valid evidence", () => {
    const result = evaluateForecastHealth([
      { asOf: "not-a-date", absoluteError: 0, directionalHit: true, intervalCovered: true },
      { asOf: "2025-01-01T00:00:00Z", absoluteError: Number.NaN, directionalHit: true, intervalCovered: true },
    ]);
    expect(result.sampleCount).toBe(0);
    expect(result.status).toBe("INSUFFICIENT_DATA");
  });
});
