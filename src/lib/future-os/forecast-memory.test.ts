import { describe, expect, it } from "vitest";
import { buildForecastLesson, type ForecastMemorySnapshot, type ForecastMemoryOutcome } from "./forecast-memory";

const forecast: ForecastMemorySnapshot = {
  forecastId: "f-1",
  memoryVersion: "v1",
  recordedAt: "2026-01-01T00:00:00.000Z",
  forecastSnapshot: {},
  evidenceSnapshot: {},
  hypothesisSnapshot: {},
  decisionSnapshot: {},
  uncertaintySnapshot: {},
  provenanceHash: "sha256:example",
};

function outcome(errorSnapshot: Record<string, unknown>): ForecastMemoryOutcome {
  return {
    observedAt: "2026-01-03T00:00:00.000Z",
    realizedSnapshot: {},
    errorSnapshot,
    lessonSnapshot: {},
    modelUpdateRequired: false,
  };
}

describe("forecast memory lessons", () => {
  it("does not treat absent error metrics as zero error", () => {
    const result = buildForecastLesson(forecast, outcome({}));
    expect(result.lessonSnapshot.meanAbsError).toBeNull();
    expect(result.lessonSnapshot.validErrorCount).toBe(0);
  });

  it("ignores non-finite error values", () => {
    const result = buildForecastLesson(forecast, outcome({ a: 2, b: Number.NaN, c: Infinity }));
    expect(result.lessonSnapshot.meanAbsError).toBe(2);
    expect(result.lessonSnapshot.validErrorCount).toBe(1);
  });

  it("preserves provenance and computes forecast age", () => {
    const result = buildForecastLesson(forecast, outcome({ absoluteError: -3 }));
    expect(result.lessonSnapshot.provenanceHash).toBe("sha256:example");
    expect(result.lessonSnapshot.forecastAgeDays).toBe(2);
    expect(result.lessonSnapshot.meanAbsError).toBe(3);
  });

  it("does not emit NaN age for malformed timestamps", () => {
    const result = buildForecastLesson(
      { ...forecast, recordedAt: "bad-date" },
      outcome({ absoluteError: 1 }),
    );
    expect(result.lessonSnapshot.forecastAgeDays).toBeNull();
  });
});
