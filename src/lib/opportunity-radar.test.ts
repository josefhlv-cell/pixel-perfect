import { describe,expect,it } from "vitest";
import { scoreOpportunity } from "./opportunity-radar";
describe("opportunity radar",()=>{
 it("rewards asymmetric high-confidence opportunities",()=>{
  const r=scoreOpportunity({id:"x",probabilityGain:.82,probabilityLargeGain:.48,probabilityLargeLoss:.06,expectedReturnBps:1400,p10ReturnBps:-400,p50ReturnBps:1200,p90ReturnBps:3000,confidence:.86,agreement:.88,liquidity:.82,dataQuality:.9,negotiationPotential:.72});
  expect(r.tier).toBe("EXCEPTIONAL");
 });
});
