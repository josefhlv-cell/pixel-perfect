import { describe, expect, it } from "vitest";
import { propagateCausalSignal, type CausalEdge } from "./causal";
import type { EvidenceObservation } from "./types";

const edge: CausalEdge = {
  edgeKey: "rates-to-credit",
  parent: "macro_indicator:rate",
  child: "macro_indicator:credit",
  expectedSign: -1,
  lagMinDays: 30,
  lagMaxDays: 180,
  strength: 0.8,
  confidence: 0.7,
  modelVersion: "test",
};

function obs(
  partial: Pick<
    EvidenceObservation,
    "id" | "entityKey" | "value" | "availableAt" | "effectiveFrom"
  > &
    Partial<EvidenceObservation>,
): EvidenceObservation {
  return {
    sourceId: "cnb",
    sourceName: "ČNB",
    sourceType: "official_statistical",
    sourceUrl: null,
    publisher: "ČNB",
    geographyType: "country",
    geographyKey: "CZ",
    entityType: "macro_indicator",
    observedAt: partial.effectiveFrom,
    publishedAt: null,
    retrievedAt: partial.availableAt,
    effectiveTo: null,
    revision: 1,
    unit: "%",
    frequency: "monthly",
    leadClass: "UNKNOWN",
    sourceReliability: 1,
    independenceGroup: "cnb",
    contentHash: partial.id,
    isRevision: false,
    supersedesId: null,
    metadata: {},
    createdAt: partial.availableAt,
    ...partial,
  };
}

describe("causal propagation", () => {
  it("reads a wrapped ČNB value and keeps the latest known period, not array order", () => {
    const early = obs({
      id: "early",
      entityKey: "rate",
      effectiveFrom: "2024-01-31T00:00:00.000Z",
      availableAt: "2024-02-15T00:00:00.000Z",
      value: { value: 5, raw: "5", snapshot_id: null },
    });
    const later = obs({
      id: "later",
      entityKey: "rate",
      effectiveFrom: "2024-06-30T00:00:00.000Z",
      availableAt: "2024-07-15T00:00:00.000Z",
      value: { value: 3.75, raw: "3,75", snapshot_id: null },
    });
    const result = propagateCausalSignal([edge], [later, early], "2024-08-01T00:00:00.000Z");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      parentEvidenceId: "later",
      parentValue: 3.75,
      direction: -1,
    });
  });

  it("reads raw text when the numeric field is absent and ignores evidence after the cutoff", () => {
    const unknown = obs({
      id: "unknown",
      entityKey: "rate",
      effectiveFrom: "2024-06-30T00:00:00.000Z",
      availableAt: "2024-07-15T00:00:00.000Z",
      value: { raw: "3,75", snapshot_id: null },
    });
    const future = obs({
      id: "future",
      entityKey: "rate",
      effectiveFrom: "2024-09-30T00:00:00.000Z",
      availableAt: "2024-10-15T00:00:00.000Z",
      value: 1,
    });
    const result = propagateCausalSignal([edge], [unknown, future], "2024-08-01T00:00:00.000Z");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ parentEvidenceId: "unknown", parentValue: 3.75 });
  });

  it("drops an object that has no numeric payload", () => {
    const unknown = obs({
      id: "unknown",
      entityKey: "rate",
      value: { snapshot_id: null, note: "missing" },
    });
    expect(propagateCausalSignal([edge], [unknown], "2024-08-01T00:00:00.000Z")).toEqual([]);
  });
});
