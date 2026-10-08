import { clamp01 } from "./mechanism-field/types";

export type FutureEvent = {
  id: string;
  nodeId: string;
  mechanism: string;
  expectedLagDays: number;
  pressure: number;
  confidence: number;
};

export type FutureWavefront = {
  orderedEvents: readonly FutureEvent[];
  leadEvent: FutureEvent | null;
  lastEvent: FutureEvent | null;
  spanDays: number;
  sequenceCoherence: number;
};

/**
 * Converts a spatial/mechanism graph into an ordered event sequence.
 *
 * This is deliberately not a calendar forecast. It is a conditional
 * propagation timeline: "if the current mechanism persists, which node/event
 * should react first, and in what order?" The resulting ordering can later be
 * scored against point-in-time realizations.
 */
export function buildFutureWavefront(input: {
  sources: readonly { nodeId: string; pressure: number }[];
  edges: readonly {
    from: string;
    to: string;
    mechanism: string;
    lagDays: number;
    transmission: number;
  }[];
}): FutureWavefront {
  const sourceMap = new Map(
    input.sources.map((source) => [source.nodeId, clamp01(source.pressure)]),
  );

  const events: FutureEvent[] = [];
  for (const source of input.sources) {
    if ((sourceMap.get(source.nodeId) ?? 0) <= 0) continue;

    const queue: Array<{ nodeId: string; days: number; pressure: number; mechanism: string }> = [{
      nodeId: source.nodeId,
      days: 0,
      pressure: clamp01(source.pressure),
      mechanism: "SOURCE",
    }];
    const bestArrival = new Map<string, number>();
    bestArrival.set(source.nodeId, 0);

    while (queue.length) {
      const current = queue.shift()!;

      for (const edge of input.edges.filter((candidate) => candidate.from === current.nodeId)) {
        if (!Number.isFinite(edge.lagDays) || edge.lagDays < 0) {
          throw new Error(`Invalid lag for ${edge.from}->${edge.to}`);
        }
        const transmission = clamp01(edge.transmission);
        const nextPressure = current.pressure * transmission;
        if (nextPressure < 0.05) continue;

        const nextDays = current.days + edge.lagDays;
        const previous = bestArrival.get(edge.to);
        if (previous != null && previous <= nextDays) continue;
        bestArrival.set(edge.to, nextDays);

        events.push({
          id: `${edge.from}->${edge.to}:${edge.mechanism}`,
          nodeId: edge.to,
          mechanism: edge.mechanism,
          expectedLagDays: nextDays,
          pressure: nextPressure,
          confidence: clamp01(nextPressure * Math.exp(-nextDays / 365)),
        });

        queue.push({
          nodeId: edge.to,
          days: nextDays,
          pressure: nextPressure,
          mechanism: edge.mechanism,
        });
      }
    }
  }

  const deduped = new Map<string, FutureEvent>();
  for (const event of events) {
    const existing = deduped.get(event.id);
    if (!existing || event.expectedLagDays < existing.expectedLagDays) {
      deduped.set(event.id, event);
    }
  }

  const orderedEvents = [...deduped.values()].sort(
    (a, b) =>
      a.expectedLagDays - b.expectedLagDays ||
      b.pressure - a.pressure ||
      a.id.localeCompare(b.id),
  );

  const leadEvent = orderedEvents[0] ?? null;
  const lastEvent = orderedEvents.at(-1) ?? null;
  const spanDays = leadEvent && lastEvent
    ? Math.max(0, lastEvent.expectedLagDays - leadEvent.expectedLagDays)
    : 0;

  const coherence = orderedEvents.length < 2
    ? orderedEvents.length ? orderedEvents[0].confidence : 0
    : clamp01(
        orderedEvents.reduce((sum, event, index) => {
          const next = orderedEvents[index + 1];
          if (!next) return sum;
          const pressureContinuity = 1 - Math.min(1, Math.abs(event.pressure - next.pressure));
          const timeContinuity = Math.exp(-Math.max(0, next.expectedLagDays - event.expectedLagDays) / 180);
          return sum + 0.5 * pressureContinuity + 0.5 * timeContinuity;
        }, 0) / (orderedEvents.length - 1),
      );

  return {
    orderedEvents,
    leadEvent,
    lastEvent,
    spanDays,
    sequenceCoherence: coherence,
  };
}
