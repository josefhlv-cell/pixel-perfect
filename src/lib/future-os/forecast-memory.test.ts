import { describe, expect, it } from "vitest";
import { buildForecastLesson, type ForecastMemoryOutcome, type ForecastMemorySnapshot } from "./forecast-memory";

const forecast: ForecastMemorySnapshot = {
  forecastId: "forecast-1",
  memoryVersion: "v1",
  recordedAt: "2026-01-01T00:00:00.000Z",
  forecastSnapshot: {},
  evidenceSnapshot: {},
  hypothesisSnapshot: {},
  decisionSnapshot: {},
  uncertaintySnapshot: {},
  provenanceHash: "abc123",
};

function outcome(errorSnapshot: Record<string, unknown>): ForecastMemoryOutcome {
  return {
    observedAt: "2026-02-01T00:00:00.000Z",
    realizedSnapshot: {},
    errorSnapshot,
    lessonSnapshot: {},
    modelUpdateRequired: false,
  };
}

describe("forecast memory lessons", () => {
  it("does not report perfect accuracy when no numeric errors exist", () => {
    const lesson = buildForecastLesson(forecast, outcome({}));
    expect(lesson.lessonSnapshot.meanAbsError).toBeNull();
  });

  it("computes mean absolute error from available numeric errors", () => {
    const lesson = buildForecastLesson(forecast, outcome({ price: -2, rent: 4, note: "not numeric" }));
    expect(lesson.lessonSnapshot.meanAbsError).toBe(3);
  });
});
