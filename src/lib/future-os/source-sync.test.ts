import { describe, expect, it, vi } from "vitest";
import { runSourceSync } from "./source-sync";
import type { EvidenceObservation } from "./types";

const observation: EvidenceObservation = {
  id: "test:1",
  sourceId: "test-source",
  sourceName: "Test source",
  sourceType: "test",
  sourceUrl: null,
  publisher: null,
  geographyType: "country",
  geographyKey: "CZ",
  entityType: "series",
  entityKey: "test-series",
  observedAt: "2025-01-01T00:00:00.000Z",
  publishedAt: null,
  retrievedAt: "2025-02-01T00:00:00.000Z",
  availableAt: "2025-02-01T00:00:00.000Z",
  effectiveFrom: "2025-01-01T00:00:00.000Z",
  effectiveTo: null,
  revision: 1,
  value: 100,
  unit: "index",
  frequency: "quarterly",
  leadClass: "UNKNOWN",
  sourceReliability: 0.5,
  independenceGroup: "test",
  contentHash: "hash",
  isRevision: false,
  supersedesId: null,
  metadata: {},
  createdAt: "2025-02-01T00:00:00.000Z",
};

describe("runSourceSync", () => {
  it("records successful empty results without pretending rows were inserted", async () => {
    const ingest = vi.fn(async () => ({ inserted: 0, unchanged: 0, revised: 0 }));
    const result = await runSourceSync("test-adapter", async () => [], ingest);

    expect(result.adapterKey).toBe("test-adapter");
    expect(result.fetched).toBe(0);
    expect(result.inserted).toBe(0);
    expect(result.error).toBeUndefined();
    expect(ingest).toHaveBeenCalledWith("test-adapter", []);
    expect(Date.parse(result.finishedAt)).toBeGreaterThanOrEqual(Date.parse(result.startedAt));
  });

  it("reports adapter failure without calling ingestion", async () => {
    const ingest = vi.fn(async () => ({ inserted: 1, unchanged: 0, revised: 0 }));
    const result = await runSourceSync(
      "broken-adapter",
      async () => {
        throw new Error("upstream unavailable");
      },
      ingest,
    );

    expect(result.error).toBe("upstream unavailable");
    expect(result.fetched).toBe(0);
    expect(ingest).not.toHaveBeenCalled();
  });

  it("reports ingestion failure separately from fetch success", async () => {
    const ingest = vi.fn(async () => {
      throw new Error("database unavailable");
    });
    const result = await runSourceSync("test-adapter", async () => [observation], ingest);

    expect(result.error).toBe("database unavailable");
    expect(result.fetched).toBe(0);
    expect(result.inserted).toBe(0);
  });

  it("forwards cancellation signal to the adapter", async () => {
    const controller = new AbortController();
    const adapter = vi.fn(async (signal?: AbortSignal) => {
      expect(signal).toBe(controller.signal);
      return [observation];
    });
    const result = await runSourceSync(
      "test-adapter",
      adapter,
      async () => ({ inserted: 1, unchanged: 0, revised: 0 }),
      controller.signal,
    );

    expect(result.fetched).toBe(1);
    expect(adapter).toHaveBeenCalledOnce();
  });
});
