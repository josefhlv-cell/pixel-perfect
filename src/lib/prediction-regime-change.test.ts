import { describe, expect, it } from "vitest";
import { detectRegimeChange } from "./prediction-regime-change";

describe("regime change detector", () => {
  it("detects a persistent level shift across multiple features", () => {
    const observations = Array.from({ length: 30 }, (_, index) => {
      const shifted = index >= 24;
      return {
        at: `2024-${String(index + 1).padStart(2, "0")}-01`,
        features: {
          priceGrowth: shifted ? 0.08 : 0.02,
          inventoryGrowth: shifted ? -0.12 : 0.03,
          daysOnMarket: shifted ? 35 : 20,
        },
      };
    });

    const result = detectRegimeChange(observations, {
      baselineWindow: 18,
      recentWindow: 6,
      minEvidenceFeatures: 2,
    });

    expect(result.detected).toBe(true);
    expect(result.changedFeatures.length).toBeGreaterThanOrEqual(2);
    expect(result.changeScore).toBeGreaterThan(0.6);
  });

  it("does not call a tiny sample a regime break", () => {
    const observations = Array.from({ length: 7 }, (_, index) => ({
      at: `2026-01-0${index + 1}`,
      features: { priceGrowth: 0.02 + index * 0.001 },
    }));

    const result = detectRegimeChange(observations);
    expect(result.detected).toBe(false);
    expect(result.limitations[0]).toContain("Insufficient");
  });

  it("flags volatility shifts separately from pure direction", () => {
    const observations = Array.from({ length: 30 }, (_, index) => ({
      at: `2025-${String(index + 1).padStart(2, "0")}-01`,
      features: {
        priceGrowth: index >= 24 ? (index % 2 ? 0.12 : -0.08) : 0.02,
      },
    }));

    const result = detectRegimeChange(observations, {
      baselineWindow: 18,
      recentWindow: 6,
      minEvidenceFeatures: 1,
    });

    expect(result.detected).toBe(true);
    expect(["VOLATILITY_SHIFT", "MIXED"]).toContain(result.direction);
  });
});
