import { describe, expect, it } from "vitest";
import { DEFAULT_CAUSAL_GRAPH, locateMarketInCausalChain, propagateCausalShock } from "./prediction-causal";
import { auditTemporalLeakage, buildHonestFolds, calibrationError } from "./prediction-validation";

describe("prediction integrity",()=>{
  it("propagates a rate shock through the financing chain",()=>{
    const out=propagateCausalShock(DEFAULT_CAUSAL_GRAPH,{},{POLICY_RATE:1000},12);
    expect(out.priceImpactBps).not.toBe(0);
    expect(out.dominantPath.length).toBeGreaterThan(0);
    expect(out.caveat).toContain("kauzální");
  });

  it("locates a financing regime",()=>{
    const phase=locateMarketInCausalChain({MORTGAGE_RATE:6000,AFFORDABILITY:-2000});
    expect(phase.phase).toBe("FINANCING");
  });

  it("rejects future-dated features",()=>{
    const issues=auditTemporalLeakage(
      [{id:"a",date:"2026-01-01",actual:1}],
      {a:{macro:"2026-02-01"}}
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe("HIGH");
  });

  it("builds forward folds with spatial exclusion",()=>{
    const rows=Array.from({length:80},(_,i)=>({
      id:String(i),
      date:`2020-${String(1+Math.floor(i/7)).padStart(2,"0")}-01`,
      lat:50+i%2*0.01, lon:15,
      actual:i
    }));
    const folds=buildHonestFolds(rows,{minTrainRecords:20,testHorizonMonths:2});
    expect(folds.length).toBeGreaterThan(0);
    expect(folds[0]?.testIds.length).toBeGreaterThan(0);
  });

  it("reports calibrated probabilities with bounded scores",()=>{
    const result=calibrationError([
      {probability:0.9,outcome:true},
      {probability:0.1,outcome:false},
      {probability:0.8,outcome:true},
      {probability:0.2,outcome:false},
    ]);
    expect(result.ece).toBeGreaterThanOrEqual(0);
    expect(result.ece).toBeLessThanOrEqual(1);
    expect(result.brier).toBeLessThan(0.1);
  });
});
