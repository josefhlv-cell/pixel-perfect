import { describe, expect, it } from "vitest";
import { evaluateFutureSurvival } from "./future-survival";

describe("Future Survival Engine", () => {
  it("rewards a future that survives independent attacks", () => {
    const result = evaluateFutureSurvival({
      candidateId: "housing-up",
      baselineScore: 0.8,
      tests: [
        { dimension: "DATA", id: "leave-one-source", description: "remove source", survived: true, lossRatio: 0.05, confidence: 0.9, evidence: ["source A", "source B"] },
        { dimension: "MODEL", id: "leave-one-model", description: "change model", survived: true, lossRatio: 0.08, confidence: 0.9, evidence: ["model ensemble"] },
        { dimension: "CAUSAL", id: "remove-rate-path", description: "remove rate mechanism", survived: true, lossRatio: 0.12, confidence: 0.85, evidence: ["income path"] },
        { dimension: "REGIME", id: "regime-shift", description: "shift regime", survived: true, lossRatio: 0.18, confidence: 0.8, evidence: ["regime memory"] },
        { dimension: "TEMPORAL", id: "lag-perturbation", description: "perturb lag", survived: true, lossRatio: 0.1, confidence: 0.85, evidence: ["stable lag"] },
        { dimension: "SPATIAL", id: "neighbor-removal", description: "remove neighboring market", survived: true, lossRatio: 0.15, confidence: 0.8, evidence: ["local data"] },
        { dimension: "SHOCK", id: "rate-shock", description: "apply rate shock", survived: true, lossRatio: 0.2, confidence: 0.8, evidence: ["stress test"] },
        { dimension: "BENCHMARK", id: "vs-naive", description: "challenge benchmark", survived: true, lossRatio: 0.1, confidence: 0.9, evidence: ["walk-forward"] },
      ],
    });

    expect(result.status).toBe("ROBUST");
    expect(result.survivalScore).toBeGreaterThan(0.72);
    expect(result.failedDimensions).toEqual([]);
  });

  it("detects a future that depends on one fragile dimension", () => {
    const result = evaluateFutureSurvival({
      candidateId: "housing-up-fragile",
      baselineScore: 0.85,
      tests: [
        { dimension: "DATA", id: "source-a", description: "remove source A", survived: false, lossRatio: 0.95, confidence: 0.9, evidence: ["single source"] },
        { dimension: "DATA", id: "source-b", description: "remove source B", survived: false, lossRatio: 0.8, confidence: 0.9, evidence: ["single source"] },
        { dimension: "MODEL", id: "model-change", description: "change model", survived: true, lossRatio: 0.1, confidence: 0.9, evidence: ["model B"] },
        { dimension: "REGIME", id: "regime-change", description: "change regime", survived: true, lossRatio: 0.1, confidence: 0.9, evidence: ["regime"] },
        { dimension: "SHOCK", id: "shock", description: "shock", survived: true, lossRatio: 0.1, confidence: 0.9, evidence: ["stress"] },
      ],
    });

    expect(result.status).toBe("FRAGILE");
    expect(result.failedDimensions).toContain("DATA");
    expect(result.decisiveAttacks[0]).toBe("source-a");
  });

  it("does not confuse missing attacks with robustness", () => {
    const result = evaluateFutureSurvival({
      candidateId: "unknown",
      baselineScore: 0.95,
      tests: [],
    });

    expect(result.status).toBe("UNKNOWN");
    expect(result.survivalScore).toBe(0);
    expect(result.confidence).toBe(0);
  });

  it("ignores low-confidence attacks when calculating survival", () => {
    const result = evaluateFutureSurvival({
      candidateId: "confidence-gated",
      baselineScore: 0.7,
      tests: [
        { dimension: "DATA", id: "low-confidence", description: "weak attack", survived: false, lossRatio: 1, confidence: 0.2, evidence: [] },
        { dimension: "MODEL", id: "valid", description: "valid attack", survived: true, lossRatio: 0.1, confidence: 0.9, evidence: ["ensemble"] },
      ],
    });

    expect(result.status).toBe("SURVIVING");
    expect(result.survivalRate).toBe(1);
    expect(result.confidence).toBeCloseTo(0.9);
  });
});
