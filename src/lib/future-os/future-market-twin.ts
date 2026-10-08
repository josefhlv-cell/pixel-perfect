import { clamp01 } from "./mechanism-field/types";

export type MarketNode = {
  id: string;
  geographyType: string;
  geographyKey: string;
  parentId?: string | null;
};

export type PropagationEdge = {
  from: string;
  to: string;
  association: number;
  velocity: number;
  lagDays: number;
  distanceKm?: number;
  spatialResistance?: number;
};

export type MarketTwinNodeState = {
  nodeId: string;
  mechanismPressure: number;
  incomingPressure: number;
  outgoingPressure: number;
  propagationVelocity: number;
  earliestArrivalDays: number | null;
  wavefrontRank: number | null;
};

export type FutureMarketTwin = {
  asOf: string;
  nodes: readonly MarketTwinNodeState[];
  wavefront: readonly string[];
  propagationConcentration: number;
};

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite.`);
}

/**
 * Spatial Future Market Twin.
 *
 * It does not assume that a shock arrives everywhere simultaneously. Pressure
 * is propagated over an explicit graph with observed/estimated lags and
 * attenuation. The result is a spatial wavefront, not a probability map.
 */
export function buildFutureMarketTwin(input: {
  asOf: string;
  nodes: readonly MarketNode[];
  edges: readonly PropagationEdge[];
  sourcePressure: Record<string, number>;
}): FutureMarketTwin {
  if (!input.nodes.length) throw new Error("Future Market Twin requires nodes.");

  const nodeIds = new Set(input.nodes.map((node) => node.id));
  for (const edge of input.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      throw new Error(`Propagation edge references an unknown node: ${edge.from}->${edge.to}`);
    }
    assertFinite(edge.association, "association");
    assertFinite(edge.velocity, "velocity");
    assertFinite(edge.lagDays, "lagDays");
    if (edge.lagDays < 0) throw new Error("lagDays cannot be negative.");
  }

  const pressure = new Map<string, number>(
    input.nodes.map((node) => [node.id, clamp01(input.sourcePressure[node.id] ?? 0)]),
  );
  const arrival = new Map<string, number>();
  const velocity = new Map<string, number>();

  for (const source of input.nodes) {
    const sourcePressure = pressure.get(source.id) ?? 0;
    if (sourcePressure <= 0) continue;

    const queue: Array<{ id: string; p: number; days: number }> = [
      { id: source.id, p: sourcePressure, days: 0 },
    ];
    const visited = new Set<string>();

    while (queue.length) {
      const current = queue.shift()!;
      if (visited.has(current.id)) continue;
      visited.add(current.id);

      for (const edge of input.edges.filter((candidate) => candidate.from === current.id)) {
        const transmission = clamp01(
          Math.abs(edge.association) *
          (0.5 + 0.5 * clamp01(Math.abs(edge.velocity))) *
          (1 - clamp01(edge.spatialResistance ?? 0)),
        );
        const nextPressure = current.p * transmission;
        if (nextPressure < 0.05) continue;

        const nextDays = current.days + edge.lagDays;
        const previousPressure = pressure.get(edge.to) ?? 0;
        pressure.set(edge.to, Math.max(previousPressure, nextPressure));

        const previousArrival = arrival.get(edge.to);
        if (previousArrival == null || nextDays < previousArrival) {
          arrival.set(edge.to, nextDays);
        }

        const previousVelocity = velocity.get(edge.to) ?? 0;
        velocity.set(edge.to, Math.max(previousVelocity, nextPressure / Math.max(nextDays, 1)));

        queue.push({ id: edge.to, p: nextPressure, days: nextDays });
      }
    }
  }

  const states = input.nodes.map((node) => {
    const outgoing = input.edges
      .filter((edge) => edge.from === node.id)
      .reduce((sum, edge) => sum + clamp01(Math.abs(edge.association)), 0);
    const incoming = input.edges
      .filter((edge) => edge.to === node.id)
      .reduce((sum, edge) => sum + clamp01(Math.abs(edge.association)), 0);

    return {
      nodeId: node.id,
      mechanismPressure: clamp01(pressure.get(node.id) ?? 0),
      incomingPressure: clamp01(incoming / Math.max(1, input.edges.length)),
      outgoingPressure: clamp01(outgoing / Math.max(1, input.edges.length)),
      propagationVelocity: clamp01(velocity.get(node.id) ?? 0),
      earliestArrivalDays: arrival.get(node.id) ?? null,
      wavefrontRank: null,
    };
  });

  const ordered = [...states]
    .filter((state) => state.earliestArrivalDays != null && state.mechanismPressure > 0)
    .sort((a, b) =>
      (a.earliestArrivalDays! - b.earliestArrivalDays!) ||
      (b.mechanismPressure - a.mechanismPressure) ||
      a.nodeId.localeCompare(b.nodeId),
    );

  const rankById = new Map(ordered.map((state, index) => [state.nodeId, index + 1]));
  const ranked = states.map((state) => ({
    ...state,
    wavefrontRank: rankById.get(state.nodeId) ?? null,
  }));

  const active = ranked.filter((state) => state.mechanismPressure > 0);
  const total = active.reduce((sum, state) => sum + state.mechanismPressure, 0);
  const top = active.reduce((max, state) => Math.max(max, state.mechanismPressure), 0);

  return {
    asOf: input.asOf,
    nodes: ranked,
    wavefront: ordered.map((state) => state.nodeId),
    propagationConcentration: total ? clamp01(top / total) : 0,
  };
}
