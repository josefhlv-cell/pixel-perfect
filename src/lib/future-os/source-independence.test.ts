import { describe, expect, it } from "vitest";
import { summarizeSourceIndependence } from "./source-independence";

describe("Source independence", () => {
  it("does not count copied sources as independent evidence", () => {
    const result = summarizeSourceIndependence([
      { evidenceId: "1", independenceGroup: "agency-wire", reliability: 1 },
      { evidenceId: "2", independenceGroup: "agency-wire", reliability: 1 },
      { evidenceId: "3", independenceGroup: "agency-wire", reliability: 1 },
      { evidenceId: "4", independenceGroup: "official-statistics", reliability: 1 },
    ]);
    expect(result.independentGroups).toBe(2);
    expect(result.effectiveEvidence).toBeLessThan(4);
    expect(result.confidenceMultiplier).toBeLessThan(1);
  });
});
