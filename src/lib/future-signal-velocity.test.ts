import {describe,it,expect} from "vitest";
import {measureFutureSignalVelocity} from "./future-signal-velocity";

describe("future signal velocity",()=>{
 it("detects a building multi-signal shift",()=>{
  const r=measureFutureSignalVelocity([
   {id:"credit",metric:"credit",value:.02,previous:.04,baseline:.05,direction:"DOWN",reliability:.9,observedAt:"2026-01-01"},
   {id:"dom",metric:"dom",value:.18,previous:.10,baseline:.05,direction:"UP",reliability:.85,observedAt:"2026-01-01"},
   {id:"inventory",metric:"inventory",value:.12,previous:.06,baseline:.02,direction:"UP",reliability:.8,observedAt:"2026-01-01"},
  ]);
  expect(r.composite).toBeGreaterThan(0);
  expect(r.earliestSignal).not.toBeNull();
  expect(r.warnings).not.toContain("low signal breadth");
 });
});
