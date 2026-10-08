import { describe, expect, it } from "vitest";
import { buildFutureField, buildMechanismState, causalAcceleration, causalVelocity, lagCompression } from "./field";
import { collapseFutures, scoreFutureSurvival } from "./future-collapse";
import { selectNextBestObservation } from "./next-best-observation";

describe("future causal field", () => {
  function fixture() {
    const mechanism = buildMechanismState("2026-10-08", [{
      edgeId: "TRANSACTIONS_TO_PRICE_PRESSURE", association: 0.8, velocity: -0.5, acceleration: -0.2,
      historicalLag: 6, currentLag: 2, spatialPropagation: 0.9, stability: 0.8,
    }], "EXPANSION", {
      expansion: 0.1, recovery: 0.1, softLanding: 0.1, deceleration: 0.4, correction: 0.9, liquidityCrisis: 0.2,
    });
    return buildFutureField(mechanism, {
      gravity: { GROWTH: 0.9, SOFT_LANDING: 0.2, STAGNATION: 0.2, CORRECTION: 0.95, LIQUIDITY_CRISIS: 0.4 },
      survival: { GROWTH: 0.3, SOFT_LANDING: 0.4, STAGNATION: 0.4, CORRECTION: 0.9, LIQUIDITY_CRISIS: 0.5 },
      causalConvergence: { GROWTH: 0.2, SOFT_LANDING: 0.3, STAGNATION: 0.4, CORRECTION: 0.9, LIQUIDITY_CRISIS: 0.6 },
      informativeness: { GROWTH: 0.7, SOFT_LANDING: 0.7, STAGNATION: 0.8, CORRECTION: 0.9, LIQUIDITY_CRISIS: 0.8 },
    });
  }

  it("measures mechanism dynamics", () => {
    expect(causalVelocity(0.8, 0.5, 1)).toBeCloseTo(0.3);
    expect(causalAcceleration(0.3, 0.1, 1)).toBeCloseTo(0.2);
    expect(lagCompression(10, 6)).toBeCloseTo(0.4);
  });

  it("separates observed regime from generative regime", () => {
    const state = buildMechanismState("2026-10-08", [{
      edgeId: "BUYER_DEMAND_TO_TRANSACTIONS", association: 0.7, velocity: -0.2, acceleration: -0.1, historicalLag: 6, currentLag: 3,
    }], "EXPANSION", {
      expansion: 0.2, recovery: 0.1, softLanding: 0.15, deceleration: 0.8, correction: 0.55, liquidityCrisis: 0.1,
    });
    expect(state.observedRegime).toBe("EXPANSION");
    expect(state.generativeRegime).toBe("DECELERATION");
    expect(state.regimeShadowDistance).toBeGreaterThan(0);
  });

  it("creates a pressure-ranked field without calling pressure a probability", () => {
    const field = fixture();
    expect(field.leadingFuture).toBe("CORRECTION");
    expect(field.attractors[0].pressure).toBeGreaterThan(0);
    expect(field.attractors[0].pressure).toBeLessThan(1);
    expect(field.decisionWindow).toMatch(/OPEN|OPENING/);
  });

  it("kills futures through falsification instead of silently averaging them away", () => {
    const field = fixture();
    const correction = field.attractors.find((item) => item.id === "CORRECTION")!;
    const survival = scoreFutureSurvival(correction, [
      { id: "credit-recovery", targetFuture: "CORRECTION", strength: 0.9, threshold: 0.8, triggered: true },
    ], [{ id: "income-growth", mechanism: "income", pressure: 0.1, preventsFuture: true }]);
    expect(survival.survival).toBeLessThan(correction.survival);
    const collapsed = collapseFutures(field.attractors, [survival], 0.25);
    expect(collapsed.some((item) => item.id === "CORRECTION")).toBe(survival.survival >= 0.25);
  });

  it("selects the observation that best separates competing futures per cost", () => {
    const field = fixture();
    const next = selectNextBestObservation(field, [
      { id: "slow-series", cost: 1, discrimination: { CORRECTION: 0.2, GROWTH: 0.1 }, freshness: 0.8, independence: 0.7 },
      { id: "fast-independent-signal", cost: 1, discrimination: { CORRECTION: 0.95, GROWTH: 0.05 }, freshness: 0.9, independence: 0.95 },
    ]);
    expect(next?.id).toBe("fast-independent-signal");
    expect(next?.resolvesFutureCompetition).toContain("CORRECTION");
  });
});
