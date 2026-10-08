import { describe, expect, it } from "vitest";
import { evaluateFutureTrajectory, findTrajectoryBottleneck } from "./trajectory";

describe("Future trajectory", () => {
  it("uses a length-normalized geometric mean", () => {
    const result = evaluateFutureTrajectory("housing-recovery",
      [
        { id:"rates", label:"Rates", timestamp:"2026-01-01", state:-1 },
        { id:"mortgages", label:"Mortgage demand", timestamp:"2026-03-01", state:1 },
        { id:"prices", label:"Prices", timestamp:"2027-01-01", state:1 },
      ],
      [
        { id:"rates-to-mortgages", from:"rates", to:"mortgages", direction:-1, probability:0.9, leadDays:60, evidenceStrength:0.9, associationStrength:0.8, survival:0.9 },
        { id:"mortgages-to-prices", from:"mortgages", to:"prices", direction:1, probability:0.8, leadDays:300, evidenceStrength:0.5, associationStrength:0.4, survival:0.5 },
      ]);
    expect(result.pathSurvival).toBeCloseTo(Math.sqrt(0.172125));
    expect(result.pathLength).toBe(2);
    expect(result.bottleneckEdgeId).toBe("mortgages-to-prices");
    expect(findTrajectoryBottleneck(result)?.id).toBe("mortgages-to-prices");
  });
  it("uses conditional probabilities along the ordered path", () => {
    const result = evaluateFutureTrajectory("conditional-chain",
      [{id:"a",label:"A",timestamp:"2026-01-01",state:1},{id:"b",label:"B",timestamp:"2026-02-01",state:1},{id:"c",label:"C",timestamp:"2026-03-01",state:1}],
      [
        {id:"a-b",from:"a",to:"b",direction:1,probability:0.9,leadDays:30,evidenceStrength:0.9,associationStrength:0.9,survival:0.9},
        {id:"b-c",from:"b",to:"c",direction:1,probability:0.8,leadDays:30,evidenceStrength:0.9,associationStrength:0.9,survival:0.9},
      ]);
    expect(result.pathProbability).toBeCloseTo(0.72);
  });
  it("marks an invalid path as broken", () => {
    const result = evaluateFutureTrajectory("empty", [], []);
    expect(result.status).toBe("BROKEN");
    expect(result.pathLength).toBe(0);
  });
});