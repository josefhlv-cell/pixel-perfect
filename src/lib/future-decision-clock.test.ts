import {describe,it,expect} from "vitest";
import {buildDecisionClock} from "./future-decision-clock";

describe("future decision clock",()=>{
 it("creates bounded actionable timing",()=>{
  const r=buildDecisionClock({currentDate:"2026-10-07T00:00:00Z",opportunityWindowDays:30,leadDays:7,invalidationDays:60,expectedUpside:.2,expectedDownside:.1,liquidity:.8,confidence:.8});
  expect(r.actBy).toContain("2026-11");
  expect(r.firstSignalBy).toContain("2026-10");
  expect(r.urgency).toBeGreaterThanOrEqual(0);
  expect(r.urgency).toBeLessThanOrEqual(1);
 });
});
