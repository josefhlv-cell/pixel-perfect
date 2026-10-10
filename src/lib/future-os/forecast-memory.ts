export type ForecastMemorySnapshot = {
  forecastId: string;
  memoryVersion: string;
  recordedAt: string;
  forecastSnapshot: Record<string, unknown>;
  evidenceSnapshot: Record<string, unknown>;
  hypothesisSnapshot: Record<string, unknown>;
  decisionSnapshot: Record<string, unknown>;
  uncertaintySnapshot: Record<string, unknown>;
  provenanceHash: string;
};

export type ForecastMemoryOutcome = {
  observedAt: string;
  realizedSnapshot: Record<string, unknown>;
  errorSnapshot: Record<string, unknown>;
  lessonSnapshot: Record<string, unknown>;
  modelUpdateRequired: boolean;
};

export function buildForecastMemory(
  input: Omit<ForecastMemorySnapshot, "recordedAt">,
  now = new Date().toISOString(),
): ForecastMemorySnapshot {
  return { ...input, recordedAt: now };
}

export function buildForecastLesson(
  forecast: ForecastMemorySnapshot,
  outcome: ForecastMemoryOutcome,
): ForecastMemoryOutcome {
  const errorValues = Object.values(outcome.errorSnapshot).filter((value): value is number => typeof value === "number");
  // Missing errors are unknown, not a perfect forecast.
  const meanAbsError = errorValues.length
    ? errorValues.reduce((sum, value) => sum + Math.abs(value), 0) / errorValues.length
    : null;

  return {
    ...outcome,
    lessonSnapshot: {
      ...outcome.lessonSnapshot,
      meanAbsError,
      provenanceHash: forecast.provenanceHash,
      forecastAgeDays: Math.max(
        0,
        (+new Date(outcome.observedAt) - +new Date(forecast.recordedAt)) / 86_400_000,
      ),
    },
  };
}
