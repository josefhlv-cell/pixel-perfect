import { describe, expect, it } from "vitest";
import { calibrateByRegime, applyCalibration } from "./regime-calibration";

describe("regime-aware calibration",()=>{
  it("widens under-covered intervals",()=>{
    const a=calibrateByRegime({
      regime:"CONTRACTION",group:"region:cz",
      samples:500,coverage90:.78,meanAbsErrorBps:900,lastUpdated:"2026-10-01"
    });
    expect(a.radiusMultiplier).toBeGreaterThan(1);
  });

  it("is conservative with sparse evidence",()=>{
    const a=calibrateByRegime(null);
    expect(a.radiusMultiplier).toBeGreaterThan(1);
    expect(a.confidenceMultiplier).toBeLessThan(1);
  });

  it("preserves quantile ordering",()=>{
    const a=calibrateByRegime({
      regime:"EXPANSION",group:"prague",
      samples:500,coverage90:.9,meanAbsErrorBps:500,lastUpdated:"2026-10-01"
    });
    const r=applyCalibration(-100,100,300,a);
    expect(r.p10).toBeLessThan(r.p50);
    expect(r.p50).toBeLessThan(r.p90);
  });
});
