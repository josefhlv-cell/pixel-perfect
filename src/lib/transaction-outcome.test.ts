import { describe, expect, it } from "vitest";
import { transactionOutcome } from "./transaction-outcome";

describe("transaction outcome",()=>{
  it("returns separate conversion and conditional price distributions",()=>{
    const r=transactionOutcome({
      askingPrice:8000000,fairValueP50:7600000,fairValueP10:7000000,fairValueP90:8200000,
      daysOnMarket:120,priceCuts:2,priceCutBps:700,listingFreshness:.5,
      propertyAtypicality:.2,marketLiquidity:.4,financingFriction:.3,
      valuationConfidence:.8,transactionEvidenceShare:.7
    });
    expect(r.saleProbability).toBeGreaterThan(0);
    expect(r.saleProbability).toBeLessThan(1);
    expect(r.conditionalPriceP10).toBeLessThan(r.conditionalPriceP50);
    expect(r.conditionalPriceP50).toBeLessThan(r.conditionalPriceP90);
  });

  it("warns when transaction evidence is weak",()=>{
    const r=transactionOutcome({
      askingPrice:8000000,fairValueP50:7600000,fairValueP10:6500000,fairValueP90:8500000,
      daysOnMarket:20,priceCuts:0,priceCutBps:0,listingFreshness:.9,
      propertyAtypicality:.8,marketLiquidity:.8,financingFriction:.1,
      valuationConfidence:.4,transactionEvidenceShare:.1
    });
    expect(r.warnings).toContain("low realized-transaction evidence");
  });
});
