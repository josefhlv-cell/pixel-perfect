import type { FutureSuperposition } from "./future-superposition";
import { buildFutureSuperposition } from "./future-superposition";
import { buildFutureField, buildMechanismState, type MechanismObservation, type RegimeEvidence } from "./mechanism-field/field";
import { collapseFutures, scoreFutureSurvival, type EscapeRoute, type Falsifier } from "./mechanism-field/future-collapse";
import { selectNextBestObservation, type ObservationCandidate } from "./mechanism-field/next-best-observation";
import type { FutureField, FutureAttractor, MechanismRegime } from "./mechanism-field/types";

export type FutureEngineInput = {
  asOf: string;
  observedRegime: MechanismRegime;
  observations: readonly MechanismObservation[];
  regimeEvidence: RegimeEvidence;
  futureInputs: {
    gravity: Partial<Record<FutureAttractor["id"], number>>;
    survival: Partial<Record<FutureAttractor["id"], number>>;
    causalConvergence: Partial<Record<FutureAttractor["id"], number>>;
    informativeness: Partial<Record<FutureAttractor["id"], number>>;
    escapePressure?: Partial<Record<FutureAttractor["id"], number>>;
  };
  falsifiers: readonly Falsifier[];
  escapeRoutes: readonly EscapeRoute[];
  nextObservations: readonly ObservationCandidate[];
  superposition?: FutureSuperposition | null;
};

export type FutureEngineOutput = {
  field: FutureField;
  superposition: FutureSuperposition | null;
  survivingFutures: readonly FutureAttractor[];
  nextBestObservation: ReturnType<typeof selectNextBestObservation>;
  falsifiersTriggered: Record<string, string[]>;
};

/**
 * End-to-end orchestration of the Future OS research loop.
 *
 * This is intentionally an orchestration layer, not a new forecasting model.
 * It connects existing transition/turning-point/superposition machinery to
 * the Future Causal Field and makes falsification an explicit state transition.
 */
export function runFutureEngine(input: FutureEngineInput): FutureEngineOutput {
  const mechanism = buildMechanismState(
    input.asOf,
    input.observations,
    input.observedRegime,
    input.regimeEvidence,
  );

  const field = buildFutureField(mechanism, input.futureInputs);

  const survivalResults = field.attractors.map((future) =>
    scoreFutureSurvival(
      future,
      input.falsifiers,
      input.escapeRoutes.filter((route) => route.mechanism === future.id || route.mechanism === "GLOBAL"),
    ),
  );

  const survivingFutures = collapseFutures(field.attractors, survivalResults);

  const nextBestObservation = selectNextBestObservation(field, input.nextObservations);

  const falsifiersTriggered = Object.fromEntries(
    survivalResults.map((result) => [result.future, result.falsifiersTriggered]),
  );

  return {
    field,
    superposition: input.superposition ?? null,
    survivingFutures,
    nextBestObservation,
    falsifiersTriggered,
  };
}

/**
 * Optional bridge from the existing convergence/turning-point stack.
 * The bridge is deliberately separate so existing probability semantics are
 * preserved and can be evaluated as an independent ablation.
 */
export function buildEngineSuperposition(input: Parameters<typeof buildFutureSuperposition>[0]) {
  return buildFutureSuperposition(input);
}
