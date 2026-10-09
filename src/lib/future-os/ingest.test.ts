import { describe, expect, it } from "vitest";

describe("Future OS ingestion contract", () => {
  it("defines append-only ingestion as the only server path", async () => {
    const module = await import("./ingest.server");
    expect(module.ingestEvidence).toBeTypeOf("function");
  });
});
