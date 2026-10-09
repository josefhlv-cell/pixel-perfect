import {describe,it,expect} from "vitest";
import {findDecisionBoundaries} from "./future-decision-boundaries";

describe("future decision boundaries",()=>{
 it("exposes a downgrade boundary for a strong but fragile deal",()=>{
  const r=findDecisionBoundaries({score:82,downsideProbability:.30,liquidity:.62});
  expect(["BUY","NEGOTIATE","WAIT","PASS"]).toContain(r.current);
  expect(r.downgrade).not.toBeNull();
  expect(r.fragility).toBeDefined();
 });
});
