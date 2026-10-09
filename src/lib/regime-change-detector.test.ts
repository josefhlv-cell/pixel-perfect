import { describe, expect, it } from "vitest";
import { detectRegimeChange } from "./regime-change-detector";

describe("regime change detector",()=>{
  it("detects a multi-signal break",()=>{
    const r=detectRegimeChange({
      currentMean:120,baselineMean:100,
      currentVolatility:1.5,baselineVolatility:1,
      currentSlope:.04,baselineSlope:.005,
      modelErrorCurrent:2,modelErrorBaseline:1,
      modelDisagreement:.8,liquidityChange:-.4,sampleSize:100
    });
    expect(r.severity).toBe("BREAK");
    expect(r.adaptationRequired).toBe(true);
    expect(r.signals.length).toBeGreaterThan(3);
  });

  it("does not invent a regime shift from stable data",()=>{
    const r=detectRegimeChange({
      currentMean:100.1,baselineMean:100,
      currentVolatility:1.01,baselineVolatility:1,
      currentSlope:.0051,baselineSlope:.005,
      modelErrorCurrent:1.01,modelErrorBaseline:1,
      modelDisagreement:.1,liquidityChange:.01,sampleSize:100
    });
    expect(r.severity).toBe("NONE");
  });
});
