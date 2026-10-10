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
  // Missing or malformed error measurements are not zero-error successes.
  const errorValues = Object.values(outcome.errorSnapshot).filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  const meanAbsError = errorValues.length
    ? errorValues.reduce((sum, value) => sum + Math.abs(value), 0) / errorValues.length
    : null;
  const recordedAtMs = Date.parse(forecast.recordedAt);
  const observedAtMs = Date.parse(outcome.observedAt);
  const forecastAgeDays =
    Number.isFinite(recordedAtMs) && Number.isFinite(observedAtMs)
      ? Math.max(0, (observedAtMs - recordedAtMs) / 86_400_000)
      : null;

  return {
    ...outcome,
    lessonSnapshot: {
      ...outcome.lessonSnapshot,
      meanAbsError,
      validErrorCount: errorValues.length,
      provenanceHash: forecast.provenanceHash,
      forecastAgeDays,
    },
  };
}
