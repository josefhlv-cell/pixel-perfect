import {describe,expect,it} from "vitest";
import {updateFuturePosterior} from "./bayesian-future-update";

describe("Bayesian future update",()=>{
  it("moves relative support when reliable evidence arrives",()=>{
    const r=updateFuturePosterior(
      {ACCELERATION:.5,SOFT_LANDING:.5},
      [{hypothesis:"ACCELERATION",likelihoodRatio:3,reliability:.95,sourceQuality:.95,reason:"credit impulse"}],
    );
    expect(r.dominant).toBe("ACCELERATION");
    expect(r.posteriors[0]!.shift).toBeGreaterThan(0);
  });
  it("does not overreact to weak evidence",()=>{
    const r=updateFuturePosterior(
      {ACCELERATION:.5,SOFT_LANDING:.5},
      [{hypothesis:"ACCELERATION",likelihoodRatio:3,reliability:.1,sourceQuality:.1,reason:"weak source"}],
    );
    expect(Math.abs(r.posteriors[0]!.shift)).toBeLessThan(.05);
  });
});
