import { describe, expect, it } from "vitest";
import { evaluateBottleneckH2 } from "./trajectory-evaluation";

describe("H2 bottleneck evaluation", () => {
  it("compares confirmed bottlenecks with unconfirmed and random links", () => {
    const result = evaluateBottleneckH2([
      { scenarioId: "a", bottleneckEdgeId: "e1", bottleneckConfirmed: true, realizedAccuracy: 0.8, randomLinkAccuracy: 0.55 },
      { scenarioId: "b", bottleneckEdgeId: "e2", bottleneckConfirmed: true, realizedAccuracy: 0.7, randomLinkAccuracy: 0.5 },
      { scenarioId: "c", bottleneckEdgeId: "e3", bottleneckConfirmed: false, realizedAccuracy: 0.45, randomLinkAccuracy: 0.5 },
      { scenarioId: "d", bottleneckEdgeId: "e4", bottleneckConfirmed: false, realizedAccuracy: 0.4, randomLinkAccuracy: 0.45 },
    ]);
    expect(result.confirmedMeanAccuracy).toBeCloseTo(0.75);
    expect(result.unconfirmedMeanAccuracy).toBeCloseTo(0.425);
    expect(result.bottleneckAccuracyLift).toBeCloseTo(0.325);
    expect(result.bottleneckVsRandomLift).toBeCloseTo(0.2);
    expect(result.sampleCount).toBe(4);
  });
  it("rejects invalid accuracy", () => {
    expect(() => evaluateBottleneckH2([{ scenarioId:"bad", bottleneckEdgeId:"e1", bottleneckConfirmed:true, realizedAccuracy:1.1, randomLinkAccuracy:0.5 }])).toThrow();
  });
});