import { describe, expect, it } from "vitest";
import { buildTimeMachineCheckpoints, buildWalkForwardDates } from "./time-machine";

const base = (id: string, availableAt: string, effectiveFrom: string, value: number) => ({
  id, sourceId: "s", sourceName: "s", sourceType: "official", sourceUrl: null, publisher: "s",
  geographyType: "country", geographyKey: "CZ", entityType: "series", entityKey: "price",
  observedAt: effectiveFrom, publishedAt: availableAt, retrievedAt: availableAt, availableAt,
  effectiveFrom, effectiveTo: null, revision: 1, value, unit: "index", frequency: "quarterly",
  leadClass: "LAGGING" as const, sourceReliability: 1, independenceGroup: "s",
  contentHash: id, isRevision: false, supersedesId: null, metadata: {}, createdAt: availableAt,
});

describe("Historical Time Machine", () => {
  it("reconstructs only evidence known at each checkpoint", () => {
    const rows = [
      base("2019", "2019-02-01T00:00:00Z", "2019-01-01T00:00:00Z", 100),
      base("2020", "2020-02-01T00:00:00Z", "2020-01-01T00:00:00Z", 110),
    ];
    const run = buildTimeMachineCheckpoints(rows, ["2019-06-01T00:00:00Z", "2020-06-01T00:00:00Z"], [365]);
    expect(run.leakageDetected).toBe(false);
    expect(run!.checkpoints[0].evidenceIds).toEqual(["2019"]);
    expect(run!.checkpoints[1].evidenceIds).toEqual(["2019", "2020"]);
  });

  it("creates deterministic walk-forward checkpoints", () => {
    const dates = buildWalkForwardDates("2020-01-01T00:00:00Z", "2020-07-01T00:00:00Z", 90);
    expect(dates.length).toBe(3);
    expect(dates[0]).toBe("2020-01-01T00:00:00.000Z");
  });
});
