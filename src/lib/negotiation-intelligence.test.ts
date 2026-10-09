import { describe, expect, it } from "vitest";
import { buildNegotiationPlan } from "./negotiation-intelligence";

describe("negotiation intelligence",()=>{
  it("produces an explicit offer ladder",()=>{
    const p=buildNegotiationPlan({
      askingPrice:8000000,
      estimatedFairValue:7600000,
      fairValueP10:7000000,
      fairValueP90:8200000,
      daysOnMarket:140,
      priceCuts:2,
      totalCutBps:700,
      comparableCount:18,
      marketLiquidity:.35,
      modelConfidence:.75,
      transactionEvidenceShare:.65
    });
    expect(p.scenarios.length).toBeGreaterThan(4);
    expect(p.opening).toBeGreaterThan(0);
    expect(p.target).toBe(7600000);
    expect(p.walkAway).toBe(7000000);
  });

  it("marks weak transaction evidence as unreliable",()=>{
    const p=buildNegotiationPlan({
      askingPrice:8000000,estimatedFairValue:7600000,fairValueP10:6500000,fairValueP90:8500000,
      daysOnMarket:20,priceCuts:0,totalCutBps:0,comparableCount:2,marketLiquidity:.8,
      modelConfidence:.5,transactionEvidenceShare:.1
    });
    expect(p.scenarios.every(x=>x.label==="UNRELIABLE")).toBe(true);
  });
});
