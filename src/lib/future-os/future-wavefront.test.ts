import { describe, expect, it } from "vitest";
import { buildFutureWavefront } from "./future-wavefront";

describe("future wavefront", () => {
  it("predicts an event ordering from explicit transmission lags", () => {
    const wave = buildFutureWavefront({
      sources: [{ nodeId: "CZ", pressure: 0.9 }],
      edges: [
        { from: "CZ", to: "CZ010", mechanism: "DEMAND", lagDays: 20, transmission: 0.9 },
        { from: "CZ", to: "CZ020", mechanism: "LIQUIDITY", lagDays: 60, transmission: 0.8 },
        { from: "CZ020", to: "CZ064", mechanism: "TRANSACTIONS", lagDays: 40, transmission: 0.8 },
      ],
    });

    expect(wave.orderedEvents[0].nodeId).toBe("CZ010");
    expect(wave.orderedEvents[1].nodeId).toBe("CZ020");
    expect(wave.orderedEvents[2].nodeId).toBe("CZ064");
    expect(wave.leadEvent?.expectedLagDays).toBe(20);
    expect(wave.lastEvent?.expectedLagDays).toBe(100);
    expect(wave.spanDays).toBe(80);
    expect(wave.sequenceCoherence).toBeGreaterThan(0);
  });

  it("drops transmissions whose pressure is too weak to be actionable", () => {
    const wave = buildFutureWavefront({
      sources: [{ nodeId: "CZ", pressure: 0.9 }],
      edges: [
        { from: "CZ", to: "CZ010", mechanism: "DEMAND", lagDays: 20, transmission: 0.01 },
      ],
    });

    expect(wave.orderedEvents).toHaveLength(0);
  });
});
