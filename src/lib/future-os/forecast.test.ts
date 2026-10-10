import { describe, expect, it } from "vitest";
import { calibrateForecastIntervals, scoreForecast, validateForecastInput, type ForecastInput } from "./forecast";
import { buildFutureRadarFoundation } from "./future-radar";
import type { EvidenceObservation } from "./types";

const evidence: EvidenceObservation = {
  id: "e1", sourceId: "s1", sourceName: "source", sourceType: "official",
  sourceUrl: null, publisher: null, geographyType: "country", geographyKey: "CZ",
  entityType: "series", entityKey: "price_growth", observedAt: "2026-01-01T00:00:00Z",
  publishedAt: "2026-02-01T00:00:00Z", retrievedAt: "2026-02-02T00:00:00Z",
  availableAt: "2026-02-02T00:00:00Z", effectiveFrom: null, effectiveTo: null,
  revision: 1, value: 2, unit: "%", frequency: "quarterly", leadClass: "LEADING",
  sourceReliability: .9, independenceGroup: "s1", contentHash: "h1",
  isRevision: false, supersedesId: null, metadata: {}, createdAt: "2026-02-02T00:00:00Z"
};

const input: ForecastInput = {
  dataCutoff: "2026-02-03T00:00:00Z", evidence: [evidence],
  p10: -2, p50: 2, p90: 6, probabilityPositive: .7,
  modelVersion: "m1", baselineVersion: "b1",
};

describe("Future OS forecast integrity", () => {
  it("rejects invalid quantiles", () => {
    expect(() => validateForecastInput({...input, p10: 3, p50: 2})).toThrow();
  });
  it("rejects evidence from after the cutoff", () => {
    expect(() => validateForecastInput({...input, dataCutoff: "2026-02-01T00:00:00Z"})).toThrow(/Point-in-time violation/);
  });
  it("scores probabilistic forecasts", () => {
    const score = scoreForecast(input, 3);
    expect(score.insideInterval).toBe(true);
    expect(score.directionalHit).toBe(true);
    expect(score.brierScore).toBeCloseTo(.09);
    expect(score.absoluteError).toBe(1);
  });
  it("scores direction relative to a supplied baseline", () => {
    const score = scoreForecast({ ...input, p10: 98, p50: 102, p90: 106 }, 103, 100);
    expect(score.directionalHit).toBe(true);
    expect(score.brierScore).toBeCloseTo(.09);
  });
  it("does not call a flat forecast directionally correct", () => {
    const score = scoreForecast({ ...input, p10: 98, p50: 100, p90: 106 }, 103, 100);
    expect(score.directionalHit).toBe(false);
  });
  it("rejects non-finite forecast values", () => {
    expect(() => validateForecastInput({ ...input, p50: Number.NaN })).toThrow(/finite/);
  });
  it("uses only matured outcomes when calibrating forecast intervals", () => {
    const history = Array.from({ length: 20 }, (_, index) => ({
      forecastIssuedAt: new Date(Date.UTC(2024, index, 1)).toISOString(),
      outcomeObservedAt: new Date(Date.UTC(2024, index, 2)).toISOString(),
      actual: index === 19 ? 20 : 5,
      p10: 0,
      p90: 10,
    }));
    const result = calibrateForecastIntervals(input, "2026-02-04T00:00:00Z", history);
    expect(result.calibration.status).toBe("CALIBRATED");
    expect(result.calibration.calibrationCutoff).toBe("2026-02-04T00:00:00.000Z");
    expect(result.p10).toBeLessThanOrEqual(input.p10);
    expect(result.p90).toBeGreaterThanOrEqual(input.p90);
  });
  it("reports DATA_STARVED rather than fabricating a future", () => {
    const radar = buildFutureRadarFoundation([], "2026-02-03T00:00:00Z", ["price_growth"]);
    expect(radar.status).toBe("DATA_STARVED");
    expect(radar.modelReady).toBe(false);
  });
});
