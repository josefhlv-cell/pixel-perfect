import {describe,expect,it} from "vitest";
import {rankResearchCandidates} from "./global-research-brain";

describe("global research brain",()=>{
  it("prefers high-impact reliable fresh research over cheap but weak research",()=>{
    const r=rankResearchCandidates([
      {id:"transactions",family:"TRANSACTIONS",source:"CZSO/CUZK",
       expectedUncertaintyReduction:.9,expectedDecisionImpact:.9,modelDisagreementReduction:.8,
       reliability:.95,freshness:.9,cost:.2,latencyHours:24,coverage:.8,
       reason:"Realized outcomes unlock empirical validation."},
      {id:"weak-blog",family:"SENTIMENT",source:"unknown",
       expectedUncertaintyReduction:.3,expectedDecisionImpact:.1,modelDisagreementReduction:.1,
       reliability:.1,freshness:1,cost:0,latencyHours:1,coverage:.1,
       reason:"Cheap sentiment."},
    ]);
    expect(r.topCandidate).toBe("transactions");
    expect(r.researchMode).toBe("TARGETED");
  });
  it("holds when there is no research candidate",()=>{
    const r=rankResearchCandidates([]);
    expect(r.researchMode).toBe("HOLD");
    expect(r.topCandidate).toBeNull();
  });
});
