import {describe,expect,it} from "vitest";
import {expectationGap} from "./expectation-gap";

describe("expectation gap",()=>{
  it("detects expectations running ahead of reality",()=>{
    const r=expectationGap([{
      period:"2026-Q2",
      askingGrowth:.12,
      searchDemandGrowth:.15,
      sentiment:.10,
      transactionGrowth:.01,
      rentGrowth:.03,
      liquidity:.02,
      sourceQuality:.9,
    }]);
    expect(r.latest?.regime).toBe("EXPECTATION_AHEAD");
    expect(r.reversalRisk).toBeGreaterThan(0);
  });
});
