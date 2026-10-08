import { describe, expect, it } from "vitest";
import { buildFutureMarketTwin } from "./future-market-twin";

describe("future market twin", () => {
  it("builds a spatial wavefront instead of assuming simultaneous transmission", () => {
    const twin = buildFutureMarketTwin({
      asOf: "2026-10-08",
      nodes: [
        { id: "CZ", geographyType: "country", geographyKey: "CZ" },
        { id: "CZ010", geographyType: "region", geographyKey: "CZ010", parentId: "CZ" },
        { id: "CZ020", geographyType: "region", geographyKey: "CZ020", parentId: "CZ" },
        { id: "CZ064", geographyType: "region", geographyKey: "CZ064", parentId: "CZ" },
      ],
      edges: [
        { from: "CZ", to: "CZ010", association: 0.9, velocity: 0.8, lagDays: 20, spatialResistance: 0.1 },
        { from: "CZ", to: "CZ020", association: 0.8, velocity: 0.5, lagDays: 60, spatialResistance: 0.2 },
        { from: "CZ020", to: "CZ064", association: 0.8, velocity: 0.7, lagDays: 40, spatialResistance: 0.1 },
      ],
      sourcePressure: { CZ: 0.9 },
    });

    expect(twin.wavefront[0]).toBe("CZ");
    expect(twin.wavefront.indexOf("CZ010")).toBeLessThan(twin.wavefront.indexOf("CZ020"));
    expect(twin.nodes.find((node) => node.nodeId === "CZ064")?.earliestArrivalDays).toBe(100);
  });
});
