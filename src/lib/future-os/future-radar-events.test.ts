import { describe, expect, it } from "vitest";
import { buildCausalChain, chainConfidence, chainLagDays } from "./causal-chain";
import { propagateImpact } from "./impact-propagation";
import { detectFutureRadarEvents } from "./future-radar-events";

describe("Future Radar event and causal propagation", () => {
  const edges = [
    { from: "rates", to: "mortgage", sign: -1 as const, lagDays: 30, confidence: 0.9 },
    { from: "mortgage", to: "demand", sign: -1 as const, lagDays: 90, confidence: 0.8 },
    { from: "demand", to: "price", sign: 1 as const, lagDays: 180, confidence: 0.7 },
  ];

  it("propagates a shock through the causal graph", () => {
    const impact = propagateImpact("rates", 1, edges);
    expect(impact.find((x) => x.key === "price")?.confidence).toBeCloseTo(0.504);
  });

  it("calculates cumulative lag and confidence", () => {
    const chain = buildCausalChain("rates", "price", edges)!;
    expect(chainLagDays(chain)).toBe(300);
    expect(chainConfidence(chain)).toBeCloseTo(0.504);
  });

  it("detects decision and uncertainty events", () => {
    const events = detectFutureRadarEvents(
      { decision: "BUY", uncertainty: 0.2 },
      { decision: "WAIT", uncertainty: 0.4 },
    );
    expect(events.some((x) => x.type === "DECISION_FLIP")).toBe(true);
    expect(events.some((x) => x.type === "UNCERTAINTY_SPIKE")).toBe(true);
  });
});
