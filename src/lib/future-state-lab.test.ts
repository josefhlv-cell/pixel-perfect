import { describe,expect,it } from "vitest";
import { futureStateLab } from "./future-state-lab";

describe("future state lab",()=>{
  it("produces a normalized competing future distribution",()=>{
    const r=futureStateLab({
      horizonMonths:12,priceGrowth:.06,rentGrowth:.04,inventoryGrowth:-.08,
      mortgageRateChange:-.01,creditGrowth:.05,domChange:-.05,liquidity:.8,supplyGrowth:-.03
    });
    expect(r.hypotheses.length).toBe(6);
    expect(r.hypotheses.reduce((s,x)=>s+x.probability,0)).toBeCloseTo(1,8);
    expect(r.entropy).toBeGreaterThanOrEqual(0);
    expect(r.entropy).toBeLessThanOrEqual(1);
  });

  it("raises transition risk when financing and inventory move sharply",()=>{
    const calm=futureStateLab({
      horizonMonths:12,priceGrowth:.03,rentGrowth:.025,inventoryGrowth:0,
      mortgageRateChange:0,creditGrowth:.01,domChange:0,liquidity:.7,supplyGrowth:0
    });
    const shock=futureStateLab({
      ...{horizonMonths:12,priceGrowth:.03,rentGrowth:.025},
      inventoryGrowth:.30,mortgageRateChange:.04,creditGrowth:-.08,
      domChange:.35,liquidity:.25,supplyGrowth:.15
    });
    expect(shock.transitionRisk).toBeGreaterThan(calm.transitionRisk);
  });
});
