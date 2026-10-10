export type MechanismRegime =
  | "EXPANSION"
  | "RECOVERY"
  | "SOFT_LANDING"
  | "DECELERATION"
  | "CORRECTION"
  | "LIQUIDITY_CRISIS"
  | "CONTESTED";

export type MechanismEdgeState = {
  edgeId: string;
  association: number;
  velocity: number;
  acceleration: number;
  historicalLag: number;
  currentLag: number;
  spatialPropagation: number;
  stability: number;
};

export type MechanismState = {
  asOf: string;
  edges: readonly MechanismEdgeState[];
  observedRegime: MechanismRegime;
  generativeRegime: MechanismRegime;
  regimeConfidence: number;
  regimeShadowDistance: number;
};

export type FutureAttractorId =
  | "GROWTH"
  | "SOFT_LANDING"
  | "STAGNATION"
  | "CORRECTION"
  | "LIQUIDITY_CRISIS";

export type FutureAttractor = {
  id: FutureAttractorId;
  gravity: number;
  survival: number;
  causalConvergence: number;
  velocityAlignment: number;
  accelerationAlignment: number;
  regimeCompatibility: number;
  informativeness: number;
  escapePressure: number;
  pressure: number;
  rank: number;
};

export type FutureField = {
  mechanism: MechanismState;
  attractors: readonly FutureAttractor[];
  leadingFuture: FutureAttractorId | null;
  futureDivergence: number;
  decisionWindow: "CLOSED" | "OPENING" | "OPEN";
  conflict: number;
};

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function assertIsoDate(value: string, name: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new Error(`${name} must be an ISO calendar date.`);
  }
}
