import { describe, expect, it } from "vitest";
import { runFutureEngine } from "./future-engine";

describe("future engine", () => {
  it("connects mechanism dynamics, competing futures, falsification and next observation", () => {
    const result = runFutureEngine({
      asOf: "2026-10-08",
      observedRegime: "EXPANSION",
      observations: [{
        edgeId: "TRANSACTIONS_TO_PRICE_PRESSURE",
        association: 0.8,
        velocity: -0.5,
        acceleration: -0.2,
        historicalLag: 6,
        currentLag: 2,
        spatialPropagation: 0.9,
        stability: 0.8,
      }],
      regimeEvidence: {
        expansion: 0.1,
        recovery: 0.1,
        softLanding: 0.1,
        deceleration: 0.4,
        correction: 0.9,
        liquidityCrisis: 0.2,
      },
      futureInputs: {
        gravity: { GROWTH: 0.9, SOFT_LANDING: 0.2, STAGNATION: 0.2, CORRECTION: 0.95, LIQUIDITY_CRISIS: 0.4 },
        survival: { GROWTH: 0.3, SOFT_LANDING: 0.4, STAGNATION: 0.4, CORRECTION: 0.9, LIQUIDITY_CRISIS: 0.5 },
        causalConvergence: { GROWTH: 0.2, SOFT_LANDING: 0.3, STAGNATION: 0.4, CORRECTION: 0.9, LIQUIDITY_CRISIS: 0.6 },
        informativeness: { GROWTH: 0.7, SOFT_LANDING: 0.7, STAGNATION: 0.8, CORRECTION: 0.9, LIQUIDITY_CRISIS: 0.8 },
      },
      falsifiers: [
        { id: "credit-recovery", targetFuture: "CORRECTION", strength: 0.9, threshold: 0.8, triggered: false },
      ],
      escapeRoutes: [
        { id: "income-growth", mechanism: "CORRECTION", pressure: 0.1, preventsFuture: true },
      ],
      nextObservations: [
        { id: "mortgage-demand", cost: 1, discrimination: { CORRECTION: 0.95, GROWTH: 0.05 }, freshness: 0.9, independence: 0.95 },
        { id: "slow-series", cost: 1, discrimination: { CORRECTION: 0.2, GROWTH: 0.1 }, freshness: 0.8, independence: 0.7 },
      ],
    });

    expect(result.field.mechanism.generativeRegime).toBe("DECELERATION");
    expect(result.field.leadingFuture).toBe("CORRECTION");
    expect(result.survivingFutures.length).toBeGreaterThan(0);
    expect(result.nextBestObservation?.id).toBe("mortgage-demand");
  });
});
