import {
  assertIsoDate,
  clamp01,
  type FutureAttractor,
  type FutureAttractorId,
  type FutureField,
  type MechanismEdgeState,
  type MechanismRegime,
  type MechanismState,
} from "./types";

export type MechanismHistory = {
  association: readonly number[];
  lag: readonly number[];
};

export type MechanismObservation = {
  edgeId: string;
  association: number;
  velocity: number;
  acceleration: number;
  historicalLag: number;
  currentLag: number;
  spatialPropagation?: number;
  stability?: number;
};

export type RegimeEvidence = {
  expansion: number;
  recovery: number;
  softLanding: number;
  deceleration: number;
  correction: number;
  liquidityCrisis: number;
};

const REGIMES: readonly MechanismRegime[] = [
  "EXPANSION",
  "RECOVERY",
  "SOFT_LANDING",
  "DECELERATION",
  "CORRECTION",
  "LIQUIDITY_CRISIS",
];

const ATTRACTORS: readonly FutureAttractorId[] = [
  "GROWTH",
  "SOFT_LANDING",
  "STAGNATION",
  "CORRECTION",
  "LIQUIDITY_CRISIS",
];

function finiteOr(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? value as number : fallback;
}

/**
 * Causal velocity is the change in an edge's association, not a price return.
 * Observational inputs must be labelled association unless causal identification
 * exists upstream.
 */
export function causalVelocity(current: number, previous: number, steps = 1): number {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || steps <= 0) {
    throw new Error("Invalid causal velocity input.");
  }
  return (current - previous) / steps;
}

export function causalAcceleration(
  currentVelocity: number,
  previousVelocity: number,
  steps = 1,
): number {
  if (
    !Number.isFinite(currentVelocity) ||
    !Number.isFinite(previousVelocity) ||
    steps <= 0
  ) {
    throw new Error("Invalid causal acceleration input.");
  }
  return (currentVelocity - previousVelocity) / steps;
}

export function lagCompression(historicalLag: number, currentLag: number): number {
  if (!Number.isFinite(historicalLag) || historicalLag <= 0 || !Number.isFinite(currentLag)) {
    throw new Error("Historical lag must be positive and current lag must be finite.");
  }
  return (historicalLag - currentLag) / historicalLag;
}

export function buildMechanismState(
  asOf: string,
  observations: readonly MechanismObservation[],
  observedRegime: MechanismRegime,
  evidence: RegimeEvidence,
): MechanismState {
  assertIsoDate(asOf, "asOf");
  if (!observations.length) throw new Error("Mechanism state requires at least one edge.");

  const edges: MechanismEdgeState[] = observations.map((item) => {
    if (!item.edgeId) throw new Error("Mechanism edge requires edgeId.");
    const historicalLag = finiteOr(item.historicalLag, 1);
    const currentLag = finiteOr(item.currentLag, historicalLag);
    if (historicalLag <= 0 || currentLag < 0) throw new Error("Invalid lag.");

    return {
      edgeId: item.edgeId,
      association: clamp01(item.association),
      velocity: finiteOr(item.velocity, 0),
      acceleration: finiteOr(item.acceleration, 0),
      historicalLag,
      currentLag,
      spatialPropagation: clamp01(finiteOr(item.spatialPropagation, 0)),
      stability: clamp01(finiteOr(item.stability, 1)),
    };
  });

  const ranked = rankRegimeEvidence(evidence);
  const generativeRegime = ranked[0]?.regime ?? "CONTESTED";
  const top = ranked[0]?.score ?? 0;
  const second = ranked[1]?.score ?? 0;
  const confidence = clamp01(top);
  const shadowDistance = clamp01(Math.abs(regimeIndex(observedRegime) - regimeIndex(generativeRegime)) / 5);

  return {
    asOf,
    edges,
    observedRegime,
    generativeRegime: confidence < 0.35 || top - second < 0.05 ? "CONTESTED" : generativeRegime,
    regimeConfidence: confidence,
    regimeShadowDistance: shadowDistance,
  };
}

function regimeIndex(regime: MechanismRegime): number {
  const index = REGIMES.indexOf(regime);
  return index < 0 ? 0 : index;
}

function rankRegimeEvidence(evidence: RegimeEvidence): { regime: MechanismRegime; score: number }[] {
  const values: Record<MechanismRegime, number> = {
    EXPANSION: clamp01(evidence.expansion),
    RECOVERY: clamp01(evidence.recovery),
    SOFT_LANDING: clamp01(evidence.softLanding),
    DECELERATION: clamp01(evidence.deceleration),
    CORRECTION: clamp01(evidence.correction),
    LIQUIDITY_CRISIS: clamp01(evidence.liquidityCrisis),
  };
  return REGIMES
    .map((regime) => ({ regime, score: values[regime] }))
    .sort((a, b) => b.score - a.score || a.regime.localeCompare(b.regime));
}

function mean(values: readonly number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function futureCompatibility(
  id: FutureAttractorId,
  mechanism: MechanismState,
): number {
  const velocities = mechanism.edges.map((edge) => edge.velocity);
  const accelerations = mechanism.edges.map((edge) => edge.acceleration);
  const avgVelocity = mean(velocities);
  const avgAcceleration = mean(accelerations);
  const compression = mean(
    mechanism.edges.map((edge) => clamp01(lagCompression(edge.historicalLag, edge.currentLag) + 0.5)),
  );

  const scoreById: Record<FutureAttractorId, number> = {
    GROWTH: 0.55 + 0.25 * clamp01(avgVelocity * 2) + 0.20 * clamp01(avgAcceleration * 2),
    SOFT_LANDING: 0.55 - 0.10 * Math.abs(avgVelocity) + 0.10 * compression,
    STAGNATION: 0.55 - 0.20 * Math.abs(avgVelocity) + 0.05 * (1 - compression),
    CORRECTION: 0.45 + 0.30 * clamp01(-avgVelocity * 2) + 0.15 * clamp01(-avgAcceleration * 2),
    LIQUIDITY_CRISIS: 0.25 + 0.45 * clamp01(-avgVelocity * 2) + 0.20 * clamp01(-avgAcceleration * 2),
  };
  return clamp01(scoreById[id]);
}

function regimeCompatibility(id: FutureAttractorId, regime: MechanismRegime): number {
  const map: Record<FutureAttractorId, readonly MechanismRegime[]> = {
    GROWTH: ["EXPANSION", "RECOVERY"],
    SOFT_LANDING: ["SOFT_LANDING", "EXPANSION"],
    STAGNATION: ["DECELERATION", "SOFT_LANDING"],
    CORRECTION: ["DECELERATION", "CORRECTION"],
    LIQUIDITY_CRISIS: ["CORRECTION", "LIQUIDITY_CRISIS"],
  };
  return regime === "CONTESTED" ? 0.5 : map[id].includes(regime) ? 1 : 0.25;
}

export function buildFutureField(
  mechanism: MechanismState,
  inputs: {
    gravity: Partial<Record<FutureAttractorId, number>>;
    survival: Partial<Record<FutureAttractorId, number>>;
    causalConvergence: Partial<Record<FutureAttractorId, number>>;
    informativeness: Partial<Record<FutureAttractorId, number>>;
    escapePressure?: Partial<Record<FutureAttractorId, number>>;
  },
): FutureField {
  const raw = ATTRACTORS.map((id) => {
    const gravity = clamp01(inputs.gravity[id] ?? 0);
    const survival = clamp01(inputs.survival[id] ?? 0);
    const causalConvergence = clamp01(inputs.causalConvergence[id] ?? 0);
    const velocityAlignment = futureCompatibility(id, mechanism);
    const accelerationAlignment = clamp01(
      0.5 + 0.5 * velocityAlignment + 0.25 * mechanism.regimeShadowDistance,
    );
    const regimeFit = regimeCompatibility(id, mechanism.generativeRegime);
    const informativeness = clamp01(inputs.informativeness[id] ?? 0);
    const escapePressure = clamp01(inputs.escapePressure?.[id] ?? 0);

    // Pressure is deliberately not a probability. It measures dynamic support
    // after accounting for survival and informativeness, with escape routes
    // acting as a penalty.
    const pressure = clamp01(
      gravity *
        survival *
        causalConvergence *
        velocityAlignment *
        accelerationAlignment *
        regimeFit *
        informativeness *
        (1 - 0.5 * escapePressure),
    );

    return {
      id,
      gravity,
      survival,
      causalConvergence,
      velocityAlignment,
      accelerationAlignment,
      regimeCompatibility: regimeFit,
      informativeness,
      escapePressure,
      pressure,
      rank: 0,
    };
  });

  const attractors = raw
    .sort((a, b) => b.pressure - a.pressure || a.id.localeCompare(b.id))
    .map((item, index) => ({ ...item, rank: index + 1 }));

  const top = attractors[0]?.pressure ?? 0;
  const second = attractors[1]?.pressure ?? 0;
  const divergence = clamp01(top - second);
  const conflict = clamp01(
    mean(attractors.map((item) => Math.abs(item.pressure - item.causalConvergence))),
  );

  return {
    mechanism,
    attractors,
    leadingFuture: attractors[0]?.id ?? null,
    futureDivergence: divergence,
    decisionWindow: divergence >= 0.30 ? "OPEN" : divergence >= 0.15 ? "OPENING" : "CLOSED",
    conflict,
  };
}
