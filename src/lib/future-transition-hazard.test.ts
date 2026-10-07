import {describe,expect,it} from "vitest";
import {transitionHazard} from "./future-transition-hazard";

describe("future transition hazard",()=>{
  it("returns normalized competing transition hazards",()=>{
    const result=transitionHazard({
      horizonMonths:12,
      priceGrowth:.06,
      rentGrowth:.04,
      inventoryGrowth:-.03,
      mortgageRateChange:-.01,
      creditGrowth:.04,
      domChange:-.03,
      liquidity:.10,
      supplyGrowth:.01,
    },"SOFT_LANDING");
    expect(result.edges.length).toBeGreaterThan(0);
    expect(result.edges.reduce((s,x)=>s+x.hazard,0)).toBeCloseTo(1,6);
    expect(result.nextLikelyTransition).not.toBeNull();
    expect(result.calibrationStatus).toBe("STRUCTURAL_UNCALIBRATED");
  });

  it("responds to financing and liquidity stress",()=>{
    const calm=transitionHazard({
      horizonMonths:12,priceGrowth:.04,rentGrowth:.03,inventoryGrowth:0,
      mortgageRateChange:0,creditGrowth:.03,domChange:0,liquidity:.2,supplyGrowth:0,
    },"SOFT_LANDING");
    const stress=transitionHazard({
      horizonMonths:12,priceGrowth:-.02,rentGrowth:0,inventoryGrowth:.15,
      mortgageRateChange:.04,creditGrowth:-.10,domChange:.30,liquidity:-.30,supplyGrowth:.05,
    },"SOFT_LANDING");
    const calmC=calm.edges.find(x=>x.to==="CORRECTION")?.hazard??0;
    const stressC=stress.edges.find(x=>x.to==="CORRECTION")?.hazard??0;
    expect(stressC).toBeGreaterThan(calmC);
  });
});
