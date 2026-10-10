export type TurningEvent = {
  onset: string;
  direction: -1 | 1;
  detectionWindowDays?: number;
};

export type TurningDetection = {
  detectedAt: string;
  direction: -1 | 1;
  score: number;
};

export type TurningPointEvaluation = {
  events: number;
  detections: number;
  matchedEvents: number;
  missedEvents: number;
  falseAlarms: number;
  precision: number;
  recall: number;
  falseAlarmsPerYear: number;
  meanLeadDays: number | null;
};

/**
 * Event-based evaluation for early-warning systems.
 *
 * A detection is a true positive only when it has the same direction and
 * occurs within the event's detection window before/at onset. Detections that
 * do not match any event are counted as false alarms. This prevents a model
 * from looking good merely because its signal sign agrees with a later outcome.
 */
export function evaluateTurningPointEvents(
  events: TurningEvent[],
  detections: TurningDetection[],
  defaultWindowDays = 90,
  evaluationStart?: string,
  evaluationEnd?: string,
): TurningPointEvaluation {
  const orderedEvents = [...events].sort((a, b) => +new Date(a.onset) - +new Date(b.onset));
  const orderedDetections = [...detections].sort((a, b) => +new Date(a.detectedAt) - +new Date(b.detectedAt));
  const matched = new Set<number>();
  const usedDetections = new Set<number>();
  const leads: number[] = [];

  orderedEvents.forEach((event, eventIndex) => {
    const end = +new Date(event.onset);
    const windowMs = (event.detectionWindowDays ?? defaultWindowDays) * 86_400_000;
    const start = end - windowMs;
    let candidate = -1;
    let bestLead = -Infinity;

    orderedDetections.forEach((detection, detectionIndex) => {
      if (usedDetections.has(detectionIndex) || detection.direction !== event.direction) return;
      const time = +new Date(detection.detectedAt);
      if (time < start || time > end) return;
      const lead = (end - time) / 86_400_000;
      if (lead > bestLead) {
        bestLead = lead;
        candidate = detectionIndex;
      }
    });

    if (candidate >= 0) {
      matched.add(eventIndex);
      usedDetections.add(candidate);
      leads.push(bestLead);
    }
  });

  const startMs = evaluationStart ? +new Date(evaluationStart) : -Infinity;
  const endMs = evaluationEnd ? +new Date(evaluationEnd) : Infinity;
  const inEvaluationWindow = (iso: string) => {
    const t = +new Date(iso);
    return t >= startMs && t <= endMs;
  };

  const falseAlarms = orderedDetections.filter((d, i) => inEvaluationWindow(d.detectedAt) && !usedDetections.has(i)).length;
  const evaluationDays = Number.isFinite(startMs) && Number.isFinite(endMs)
    ? Math.max(1, (endMs - startMs) / 86_400_000)
    : Math.max(
        1,
        orderedDetections.length > 1
          ? (+new Date(orderedDetections.at(-1)!.detectedAt) - +new Date(orderedDetections[0]!.detectedAt)) / 86_400_000
          : 365,
      );

  const precision = orderedDetections.length ? matched.size / orderedDetections.length : 0;
  const recall = orderedEvents.length ? matched.size / orderedEvents.length : 0;

  return {
    events: orderedEvents.length,
    detections: orderedDetections.length,
    matchedEvents: matched.size,
    missedEvents: orderedEvents.length - matched.size,
    falseAlarms,
    precision,
    recall,
    falseAlarmsPerYear: falseAlarms * 365 / evaluationDays,
    meanLeadDays: leads.length ? leads.reduce((a, b) => a + b, 0) / leads.length : null,
  };
}
