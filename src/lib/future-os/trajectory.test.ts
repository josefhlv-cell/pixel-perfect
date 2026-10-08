import { describe, expect, it } from "vitest";
import { evaluateFutureTrajectory, findTrajectoryBottleneck } from "./trajectory";

describe("Future trajectory", () => {
  it("finds the weakest causal transition instead of hiding it", () => {
    const result = evaluateFutureTrajectory(
      "housing-recovery",
      [
        { id: "rates", label: "Rates", timestamp: "2026-01-01", state: -1 },
        { id: "mortgages", label: "Mortgage demand", timestamp: "2026-03-01", state: 1 },
        { id: "prices", label: "Prices", timestamp: "2027-01-01", state: 1 },
      ],
      [
        {
          id: "rates-to-mortgages",
          from: "rates",
          to: "mortgages",
          direction: -1,
          probability: 0.9,
          leadDays: 60,
          evidenceStrength: 0.9,
          causalStrength: 0.8,
          survival: 0.9,
        },
        {
          id: "mortgages-to-prices",
          from: "mortgages",
          to: "prices",
          direction: 1,
          probability: 0.8,
          leadDays: 300,
          evidenceStrength: 0.5,
          causalStrength: 0.4,
          survival: 0.5,
        },
      ],
    );

    expect(result.bottleneckEdgeId).toBe("mortgages-to-prices");
    expect(findTrajectoryBottleneck(result)?.id).toBe("mortgages-to-prices");
    expect(result.status).toBe("FRAGILE");
  });

  it("marks an invalid path as broken", () => {
    const result = evaluateFutureTrajectory("empty", [], []);
    expect(result.status).toBe("BROKEN");
    expect(result.pathProbability).toBe(0);
  });
});