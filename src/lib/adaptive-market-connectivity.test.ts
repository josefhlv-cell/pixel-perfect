import {describe,it,expect} from "vitest";
import {evaluateMarketConnectivity} from "./adaptive-market-connectivity";

describe("adaptive market connectivity",()=>{
 it("rejects connectivity when it loses OOS",()=>{
  const r=evaluateMarketConnectivity(
   [{from:"A",to:"B",lagMonths:1,strength:.8,stability:.9}],
   {localLoss:1,connectedLoss:1.1,sampleSize:100}
  );
  expect(r.recommendedMode).toBe("LOCAL");
 });
 it("does not overclaim without OOS evidence",()=>{
  const r=evaluateMarketConnectivity(
   [{from:"A",to:"B",lagMonths:1,strength:.9,stability:.9}]
  );
  expect(r.reason).toContain("provisional");
 });
});
