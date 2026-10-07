import { describe, expect, it } from "vitest";
import { decisionTournament, realizedReturn, comparePredictionVsDecisionSkill } from "./decision-outcome-lab";

describe("decision outcome lab",()=>{
  it("includes rent and explicit costs in realized return",()=>{
    const r=realizedReturn({
      id:"x",date:"2026-01-01",purchasePrice:1000000,realizedValue:1100000,
      realizedRent:10000,holdingMonths:12,transactionCostBps:500,financingCostBps:300,
      forecastP50:1050000,forecastP10:950000,forecastP90:1150000,
      probabilityGain:.7,probabilityLoss:.2,recommendedAction:"BUY",
      alternativeAction:"PASS",modelConfidence:.8
    });
    expect(r).toBe(1020);
  });

  it("produces a decision scoreboard",()=>{
    const out=decisionTournament([]);
    expect(out.samples).toBe(0);
  });

  it("distinguishes prediction skill from decision skill",()=>{
    const out=comparePredictionVsDecisionSkill(.9,.6);
    expect(out.gap).toBeCloseTo(-.3);
    expect(out.interpretation).toContain("not translating");
  });
});
