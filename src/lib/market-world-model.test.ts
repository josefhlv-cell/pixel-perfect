import { describe,expect,it } from "vitest";
import { simulateWorld } from "./market-world-model";

const base={
  priceGrowth:.05,rentGrowth:.04,mortgageRate:.045,policyRate:.035,inflation:.025,
  incomeGrowth:.05,unemployment:.04,inventoryGrowth:.02,demandGrowth:.03,
  constructionGrowth:.03,liquidity:.5
};

describe("market world model",()=>{
  it("is deterministic for the same seed",()=>{
    const a=simulateWorld(base,1000,42),b=simulateWorld(base,1000,42);
    expect(a).toEqual(b);
  });
  it("produces ordered quantiles and valid probabilities",()=>{
    const x=simulateWorld(base,1000,7);
    expect(x.quantiles.p05).toBeLessThanOrEqual(x.quantiles.p10);
    expect(x.quantiles.p10).toBeLessThanOrEqual(x.quantiles.p50);
    expect(x.quantiles.p50).toBeLessThanOrEqual(x.quantiles.p90);
    expect(x.probabilityPositive).toBeGreaterThanOrEqual(0);
    expect(x.probabilityPositive).toBeLessThanOrEqual(1);
    expect(x.survivalProbability).toBeGreaterThanOrEqual(0);
    expect(x.survivalProbability).toBeLessThanOrEqual(1);
    expect(x.cvar10).toBeLessThanOrEqual(x.var10);
  });
  it("covers all regimes with probabilities summing to one",()=>{
    const x=simulateWorld(base,2000,11);
    expect(Object.keys(x.regimeMix)).toHaveLength(6);
    expect(Object.values(x.regimeMix).reduce((a,b)=>a+b,0)).toBeCloseTo(1,6);
  });
});