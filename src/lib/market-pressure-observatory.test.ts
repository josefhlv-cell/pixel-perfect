import {describe,expect,it} from "vitest";
import {marketPressure} from "./market-pressure-observatory";

describe("market pressure observatory",()=>{
  it("detects broad upside pressure",()=>{
    const r=marketPressure({
      priceGrowth:.08,rentGrowth:.06,inventoryGrowth:-.08,domGrowth:-.12,
      mortgageRateChange:-.01,creditGrowth:.08,liquidity:.8,supplyGrowth:-.02,
      wageGrowth:.05,unemploymentChange:-.01,priceDropGrowth:-.10,transactionGrowth:.10,
    });
    expect(r.composite).toBeGreaterThan(0);
    expect(r.earlyWarning).toBe("BROAD_UPSIDE_PRESSURE");
  });
  it("detects conflicting evidence",()=>{
    const r=marketPressure({
      priceGrowth:.03,rentGrowth:.05,inventoryGrowth:-.05,domGrowth:.10,
      mortgageRateChange:.01,creditGrowth:-.08,liquidity:.2,supplyGrowth:.10,
      wageGrowth:.04,unemploymentChange:.01,priceDropGrowth:.20,transactionGrowth:.08,
    });
    expect(r.conflict).toBeGreaterThan(0);
    expect(r.confidence).toBeLessThan(0.92);
  });
});
