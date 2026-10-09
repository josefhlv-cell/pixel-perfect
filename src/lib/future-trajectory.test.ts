import {describe,expect,it} from "vitest";
import {buildFutureTrajectory,trajectoryEvidence} from "./future-trajectory";
import type {FutureStateVector} from "./future-state-lab";

const state:FutureStateVector={
  horizonMonths:12,
  priceGrowth:.06,
  rentGrowth:.04,
  inventoryGrowth:-.04,
  mortgageRateChange:-.01,
  creditGrowth:.05,
  domChange:-.05,
  liquidity:.08,
  supplyGrowth:.01,
};

const hypotheses=[
  {id:"ACCELERATION",probability:.30,expectedPriceGrowth:.08,expectedRentGrowth:.05,confidence:.7,triggers:[],invalidators:[],leadingSignals:[]},
  {id:"SOFT_LANDING",probability:.40,expectedPriceGrowth:.03,expectedRentGrowth:.025,confidence:.7,triggers:[],invalidators:[],leadingSignals:[]},
  {id:"DECELERATION",probability:.15,expectedPriceGrowth:.005,expectedRentGrowth:.02,confidence:.6,triggers:[],invalidators:[],leadingSignals:[]},
  {id:"CORRECTION",probability:.05,expectedPriceGrowth:-.07,expectedRentGrowth:-.01,confidence:.5,triggers:[],invalidators:[],leadingSignals:[]},
  {id:"LIQUIDITY_CRISIS",probability:.03,expectedPriceGrowth:-.10,expectedRentGrowth:-.02,confidence:.4,triggers:[],invalidators:[],leadingSignals:[]},
  {id:"RECOVERY",probability:.07,expectedPriceGrowth:.015,expectedRentGrowth:.025,confidence:.5,triggers:[],invalidators:[],leadingSignals:[]},
] as const;

describe("future trajectory",()=>{
  it("creates ordered multi-horizon points with valid quantiles",()=>{
    const result=buildFutureTrajectory(state,[...hypotheses]);
    expect(result.points.map(x=>x.month)).toEqual([1,3,6,12,24,36]);
    for(const p of result.points){
      expect(p.p10PriceGrowth).toBeLessThanOrEqual(p.p25PriceGrowth);
      expect(p.p25PriceGrowth).toBeLessThanOrEqual(p.p50PriceGrowth);
      expect(p.p50PriceGrowth).toBeLessThanOrEqual(p.p75PriceGrowth);
      expect(p.p75PriceGrowth).toBeLessThanOrEqual(p.p90PriceGrowth);
      expect(p.regimeSupport).toBeGreaterThanOrEqual(0);
      expect(p.regimeSupport).toBeLessThanOrEqual(1);
    }
    expect(result.calibrationStatus).toBe("STRUCTURAL_UNCALIBRATED");
  });

  it("lets strong reliable evidence move the trajectory support",()=>{
    const base=buildFutureTrajectory(state,[...hypotheses]);
    const evidence=trajectoryEvidence(
      "e1","CORRECTION",1.5,"2026-10-07","2026-10-07",
      "transaction volume deteriorates",1,1
    );
    const updated=buildFutureTrajectory(state,[...hypotheses],[evidence]);
    expect(updated.evidenceImpact).toBeGreaterThan(0);
    expect(updated.pathEntropy).toBeLessThanOrEqual(1);
    expect(updated.points.length).toBe(base.points.length);
  });

  it("does not claim empirical probability without calibration",()=>{
    const result=buildFutureTrajectory(state,[...hypotheses]);
    expect(result.audit.some(x=>x.includes("not empirical probabilities"))).toBe(true);
  });
});
