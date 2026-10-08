import { describe, expect, it } from "vitest";
import { scoreForecast, validateForecastInput, type ForecastInput } from "./forecast";
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
  it("reports DATA_STARVED rather than fabricating a future", () => {
    const radar = buildFutureRadarFoundation([], "2026-02-03T00:00:00Z", ["price_growth"]);
    expect(radar.status).toBe("DATA_STARVED");
    expect(radar.modelReady).toBe(false);
  });
});
