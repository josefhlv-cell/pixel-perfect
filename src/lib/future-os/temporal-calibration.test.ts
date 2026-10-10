import { describe, expect, it } from "vitest";
import {
  calibratePredictionInterval,
  type IntervalCalibrationObservation,
} from "./temporal-calibration";

const issuedAt = "2026-01-01T00:00:00.000Z";

function history(
  count: number,
  scoreForIndex: (index: number) => number = () => 0,
): IntervalCalibrationObservation[] {
  return Array.from({ length: count }, (_, index) => {
    const month = index + 1;
    const score = scoreForIndex(index);
    return {
      forecastIssuedAt: new Date(Date.UTC(2024, month - 1, 1)).toISOString(),
      outcomeObservedAt: new Date(Date.UTC(2024, month - 1, 2)).toISOString(),
      actual: 5 + score,
      p10: 0,
      p90: 10,
    };
  });
}

describe("temporal conformal calibration", () => {
  it("expands the interval using the finite-sample conformal order statistic", () => {
    const calibrationHistory = history(20, (index) => (index >= 18 ? 5 : 0));
    const result = calibratePredictionInterval({
      issuedAt,
      p10: 8,
      p50: 10,
      p90: 12,
      history: calibrationHistory,
      alpha: 0.1,
      minSamples: 20,
    });

    expect(result.status).toBe("CALIBRATED");
    expect(result.expansion).toBe(5);
    expect(result.p10).toBe(3);
    expect(result.p50).toBe(10);
    expect(result.p90).toBe(17);
    expect(result.sampleCount).toBe(20);
  });

  it("excludes outcomes that were not observable at issuance time", () => {
    const matured = history(19);
    const future = {
      forecastIssuedAt: "2025-12-01T00:00:00.000Z",
      outcomeObservedAt: "2026-02-01T00:00:00.000Z",
      actual: 99,
      p10: 0,
      p90: 10,
    };
    const result = calibratePredictionInterval({
      issuedAt,
      p10: 8,
      p50: 10,
      p90: 12,
      history: [...matured, future],
      minSamples: 20,
    });

    expect(result.status).toBe("INSUFFICIENT_DATA");
    expect(result.sampleCount).toBe(19);
    expect(result.excludedFutureOutcomes).toBe(1);
    expect(result.p10).toBe(8);
    expect(result.p90).toBe(12);
  });

  it("does not claim calibration when history is too small", () => {
    const result = calibratePredictionInterval({
      issuedAt,
      p10: 0,
      p50: 5,
      p90: 10,
      history: history(3),
      minSamples: 20,
    });
    expect(result.status).toBe("INSUFFICIENT_DATA");
    expect(result.expansion).toBe(0);
  });

  it("drops malformed historic outcomes", () => {
    const invalid = {
      forecastIssuedAt: "not-a-date",
      outcomeObservedAt: "2025-12-01T00:00:00.000Z",
      actual: 10,
      p10: 0,
      p90: 20,
    };
    const result = calibratePredictionInterval({
      issuedAt,
      p10: 0,
      p50: 5,
      p90: 10,
      history: [...history(3), invalid],
      minSamples: 4,
    });
    expect(result.status).toBe("INSUFFICIENT_DATA");
    expect(result.sampleCount).toBe(3);
  });

  it("rejects invalid current forecast quantiles", () => {
    expect(() =>
      calibratePredictionInterval({
        issuedAt,
        p10: 11,
        p50: 10,
        p90: 12,
        history: history(20),
      }),
    ).toThrow(/quantiles must be ordered/);
  });

  it("rejects invalid alpha and window parameters", () => {
    const input = { issuedAt, p10: 0, p50: 5, p90: 10, history: history(20) };
    expect(() => calibratePredictionInterval({ ...input, alpha: 1 })).toThrow(/alpha/);
    expect(() => calibratePredictionInterval({ ...input, windowSize: 0 })).toThrow(/windowSize/);
  });
});
