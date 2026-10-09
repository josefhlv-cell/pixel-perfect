import { describe, expect, it } from "vitest";
import { rankResearchAgenda, shouldContinueResearch } from "./autonomous-research-loop";

describe("autonomous research loop",()=>{
  it("prioritizes evidence with high decision impact",()=>{
    const out=rankResearchAgenda([
      {id:"a",kind:"TRANSACTION_DATA",description:"matched sale",expectedInformationGain:.8,decisionImpact:.95,freshness:.9,reliability:.95,cost:.2,latency:.2,currentGap:.9},
      {id:"b",kind:"MACRO",description:"macro update",expectedInformationGain:.4,decisionImpact:.2,freshness:.9,reliability:.9,cost:.1,latency:.1,currentGap:.2}
    ]);
    expect(out[0]!.id).toBe("a");
  });

  it("stops low-value research for a PASS decision",()=>{
    expect(shouldContinueResearch(.4,"PASS")).toBe(false);
    expect(shouldContinueResearch(.8,"PASS")).toBe(true);
  });
});
