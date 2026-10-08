import { describe, expect, it } from "vitest";
import {
  buildFutureField,
  buildMechanismState,
  causalAcceleration,
  causalVelocity,
  lagCompression,
} from "./field";

describe("future causal field", () => {
  it("measures causal velocity and acceleration without turning them into probabilities", () => {
    expect(causalVelocity(0.8, 0.5, 1)).toBeCloseTo(0.3);
    expect(causalAcceleration(0.3, 0.1, 1)).toBeCloseTo(0.2);
    expect(lagCompression(10, 6)).toBeCloseTo(0.4);
  });

  it("detects a generative regime that differs from the observed regime", () => {
    const state = buildMechanismState(
      "2026-10-08",
      [{
        edgeId: "BUYER_DEMAND_TO_TRANSACTIONS",
        association: 0.7,
        velocity: -0.2,
        acceleration: -0.1,
        historicalLag: 6,
        currentLag: 3,
        spatialPropagation: 0.7,
        stability: 0.8,
      }],
      "EXPANSION",
      {
        expansion: 0.2,
        recovery: 0.1,
        softLanding: 0.15,
        deceleration: 0.8,
        correction: 0.55,
        liquidityCrisis: 0.1,
      },
    );

    expect(state.observedRegime).toBe("EXPANSION");
    expect(state.generativeRegime).toBe("DECELERATION");
    expect(state.regimeShadowDistance).toBeGreaterThan(0);
  });

  it("keeps pressure separate from probability and opens a decision window when futures separate", () => {
    const mechanism = buildMechanismState(
      "2026-10-08",
      [{
        edgeId: "TRANSACTIONS_TO_PRICE_PRESSURE",
        association: 0.8,
        velocity: -0.5,
        acceleration: -0.2,
        historicalLag: 6,
        currentLag: 2,
        spatialPropagation: 0.9,
        stability: 0.8,
      }],
      "EXPANSION",
      {
        expansion: 0.1,
        recovery: 0.1,
        softLanding: 0.1,
        deceleration: 0.4,
        correction: 0.9,
        liquidityCrisis: 0.2,
      },
    );

    const field = buildFutureField(mechanism, {
      gravity: {
        GROWTH: 0.9,
        SOFT_LANDING: 0.2,
        STAGNATION: 0.2,
        CORRECTION: 0.95,
        LIQUIDITY_CRISIS: 0.4,
      },
      survival: {
        GROWTH: 0.3,
        SOFT_LANDING: 0.4,
        STAGNATION: 0.4,
        CORRECTION: 0.9,
        LIQUIDITY_CRISIS: 0.5,
      },
      causalConvergence: {
        GROWTH: 0.2,
        SOFT_LANDING: 0.3,
        STAGNATION: 0.4,
        CORRECTION: 0.9,
        LIQUIDITY_CRISIS: 0.6,
      },
      informativeness: {
        GROWTH: 0.7,
        SOFT_LANDING: 0.7,
        STAGNATION: 0.8,
        CORRECTION: 0.9,
        LIQUIDITY_CRISIS: 0.8,
      },
    });

    expect(field.leadingFuture).toBe("CORRECTION");
    expect(field.attractors[0].pressure).toBeGreaterThan(0);
    expect(field.attractors[0].pressure).not.toBe(0.9);
    expect(field.decisionWindow).toMatch(/OPEN|OPENING/);
  });
});
