import { clamp01, type FutureAttractorId, type FutureField } from "./types";

export type ObservationCandidate = {
  id: string;
  cost: number;
  discrimination: Partial<Record<FutureAttractorId, number>>;
  freshness: number;
  independence: number;
};

export type NextBestObservation = ObservationCandidate & {
  score: number;
  resolvesFutureCompetition: FutureAttractorId[];
};

export function selectNextBestObservation(
  field: FutureField,
  observations: readonly ObservationCandidate[],
): NextBestObservation | null {
  if (!observations.length || !field.attractors.length) return null;

  const top = field.attractors.slice(0, Math.min(3, field.attractors.length));
  const result = observations
    .map((observation) => {
      if (!Number.isFinite(observation.cost) || observation.cost <= 0) {
        throw new Error(`Observation ${observation.id} has invalid cost.`);
      }

      const targets = top
        .filter((future) => (observation.discrimination[future.id] ?? 0) > 0)
        .map((future) => future.id);

      const separation = top.length > 1
        ? Math.abs(
            (observation.discrimination[top[0].id] ?? 0) -
            (observation.discrimination[top[1].id] ?? 0),
          )
        : observation.discrimination[top[0].id] ?? 0;

      const score = clamp01(
        (separation * 0.55 +
          clamp01(observation.freshness) * 0.2 +
          clamp01(observation.independence) * 0.25) /
          observation.cost,
      );

      return { ...observation, score, resolvesFutureCompetition: targets };
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  return result[0] ?? null;
}
