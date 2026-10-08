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
});
