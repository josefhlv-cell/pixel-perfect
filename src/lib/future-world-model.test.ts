import {describe,it,expect} from "vitest";
import {buildFutureWorldModel} from "./future-world-model";

describe("future world model",()=>{
 it("keeps future reasoning bounded and auditable",()=>{
  const r=buildFutureWorldModel({
   market:{
    horizonMonths:24,priceGrowth:.04,rentGrowth:.03,inventoryGrowth:-.08,
    mortgageRateChange:-.01,creditGrowth:.05,domChange:-.05,liquidity:.8,
    supplyGrowth:.02,evidence:.75,modelRisk:.15,
   },
   property:{
    price:5000000,fairValue:5600000,rent:18000,rentGrowth:.03,
    condition:.8,locationScore:.9,liquidity:.8,confidence:.8,modelRisk:.15,
   },
  });
  expect(r.version).toBe("future-world-v1");
  expect(r.market.hypotheses).toHaveLength(6);
  expect(r.market.hypotheses.reduce((s,x)=>s+x.probability,0)).toBeCloseTo(1,8);
  expect(r.confidence).toBeGreaterThanOrEqual(0);
  expect(r.confidence).toBeLessThanOrEqual(1);
  expect(r.uncertainty).toBeGreaterThanOrEqual(0);
  expect(r.uncertainty).toBeLessThanOrEqual(1);
  expect(["BUY","NEGOTIATE","WAIT","PASS"]).toContain(r.decision);
  if(r.futureScore) expect(r.futureScore.score).toBeGreaterThanOrEqual(0);
 });
});
