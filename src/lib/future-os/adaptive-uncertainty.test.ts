import { describe, expect, it } from "vitest";
import { calibrateAdaptiveInterval } from "./adaptive-uncertainty";
import { evaluateTurningPointEvents } from "./turning-point-evaluation";

describe("adaptive uncertainty", () => {
  it("widens intervals from recent residuals", () => {
    const result = calibrateAdaptiveInterval({
      p50: 100,
      residuals: Array.from({ length: 24 }, (_, i) => ({
        asOf: `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
        absoluteResidual: i % 2 ? 4 : 2,
        signedResidual: i % 2 ? 4 : -2,
      })),
    });
    expect(result.status).toBe("CALIBRATED");
    expect(result.p10).toBeLessThan(100);
    expect(result.p90).toBeGreaterThan(100);
    expect(result.calibrationSamples).toBe(24);
  });

  it("resets calibration on regime change", () => {
    const result = calibrateAdaptiveInterval({
      p50: 100,
      regime: "CORRECTION",
      regimeChanged: true,
      residuals: Array.from({ length: 25 }, (_, i) => ({
        asOf: `2026-02-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
        absoluteResidual: 10,
        signedResidual: 10,
        regime: "EXPANSION",
      })),
    });
    expect(result.status).toBe("REGIME_RESET");
    expect(result.regimeReset).toBe(true);
  });
});

describe("turning-point event evaluation", () => {
  it("separates matched warnings, misses and false alarms", () => {
    const result = evaluateTurningPointEvents(
      [{ onset: "2026-06-01T00:00:00Z", direction: -1, detectionWindowDays: 30 }],
      [
        { detectedAt: "2026-05-20T00:00:00Z", direction: -1, score: 0.9 },
        { detectedAt: "2026-04-01T00:00:00Z", direction: -1, score: 0.9 },
        { detectedAt: "2026-05-25T00:00:00Z", direction: 1, score: 0.9 },
      ],
      30,
      "2026-04-01T00:00:00Z",
      "2026-06-10T00:00:00Z",
    );
    expect(result.matchedEvents).toBe(1);
    expect(result.missedEvents).toBe(0);
    expect(result.falseAlarms).toBe(2);
    expect(result.meanLeadDays).toBe(12);
  });
});
