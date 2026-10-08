import { clamp01, type FutureAttractor } from "./types";

export type Falsifier = {
  id: string;
  targetFuture: FutureAttractor["id"];
  strength: number;
  threshold: number;
  triggered: boolean;
};

export type FutureSurvivalResult = {
  future: FutureAttractor["id"];
  survival: number;
  effectiveInformativeness: number;
  falsifiersTriggered: string[];
  escapeRoutes: readonly EscapeRoute[];
};

export type EscapeRoute = {
  id: string;
  mechanism: string;
  pressure: number;
  preventsFuture: boolean;
};

export function scoreFutureSurvival(
  future: FutureAttractor,
  falsifiers: readonly Falsifier[],
  escapeRoutes: readonly EscapeRoute[],
): FutureSurvivalResult {
  const relevant = falsifiers.filter((item) => item.targetFuture === future.id);
  const triggered = relevant.filter((item) => item.triggered);
  const attackLoss = relevant.length
    ? triggered.reduce((sum, item) => sum + clamp01(item.strength), 0) / relevant.length
    : 0;

  const escapePressure = escapeRoutes
    .filter((route) => route.preventsFuture)
    .reduce((sum, route) => sum + clamp01(route.pressure), 0);

  // Survival is a stress score, not probability.
  const survival = clamp01(
    future.survival * (1 - 0.7 * attackLoss) * (1 - 0.4 * clamp01(escapePressure)),
  );

  const effectiveInformativeness = clamp01(
    future.informativeness * (future.pressure > 0.05 ? 1 : 0.25),
  );

  return {
    future: future.id,
    survival,
    effectiveInformativeness,
    falsifiersTriggered: triggered.map((item) => item.id),
    escapeRoutes,
  };
}

export function collapseFutures(
  futures: readonly FutureAttractor[],
  survival: readonly FutureSurvivalResult[],
  minimumSurvival = 0.25,
): readonly FutureAttractor[] {
  const survivalByFuture = new Map(survival.map((item) => [item.future, item]));
  return futures
    .filter((future) => (survivalByFuture.get(future.id)?.survival ?? 0) >= minimumSurvival)
    .map((future) => {
      const state = survivalByFuture.get(future.id);
      return state
        ? { ...future, survival: state.survival, pressure: clamp01(future.pressure * state.effectiveInformativeness) }
        : future;
    })
    .sort((a, b) => b.pressure - a.pressure || a.id.localeCompare(b.id))
    .map((future, index) => ({ ...future, rank: index + 1 }));
}
