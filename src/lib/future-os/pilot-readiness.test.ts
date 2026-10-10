import { describe, expect, it } from "vitest";
import { assessPilotReadiness, getPilotDesignSummary } from "./pilot-readiness";

describe("pilot readiness", () => {
  it("blocks a real pilot while the vintage audit and source validation are incomplete", () => {
    const readiness = assessPilotReadiness({
      sourceAdaptersVerified: false,
      pointInTimeSnapshotsAvailable: false,
      baselineImplementationsAvailable: false,
      localTestsPassed: false,
    });
    expect(readiness.status).toBe("BLOCKED");
    expect(readiness.blockers).toContainEqual(expect.stringContaining("STRICT_VINTAGE_AUDIT"));
    expect(readiness.blockers).toContainEqual(expect.stringContaining("SOURCE_ADAPTERS"));
  });

  it("exposes the frozen pilot split without silently changing it", () => {
    const design = getPilotDesignSummary();
    expect(design.frequency).toBe("QUARTERLY");
    expect(design.training).toEqual(["2010-01-01", "2019-12-31"]);
    expect(design.holdout).toEqual(["2020-01-01", "2022-12-31"]);
    expect(design.regions).toHaveLength(14);
    expect(design.vintagePolicy).toBe("STRICT");
  });
});
