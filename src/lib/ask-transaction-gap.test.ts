import {describe,expect,it} from "vitest";
import {askTransactionGap} from "./ask-transaction-gap";

describe("ask transaction gap",()=>{
  it("detects widening negotiation pressure",()=>{
    const r=askTransactionGap([
      {period:"2025-Q4",askingIndex:120,realizedIndex:118,sourceQuality:.9,availableAt:"2026-01-01"},
      {period:"2026-Q1",askingIndex:125,realizedIndex:121,sourceQuality:.9,availableAt:"2026-04-01"},
    ]);
    expect(r.widening).toBe(true);
    expect(r.latest?.direction).toBe("NEGOTIATION_PRESSURE");
    expect(r.pressure).toBeGreaterThan(0);
  });
});
