import {describe,expect,it} from "vitest";
import {judgeForecastConstitution} from "./forecast-constitution";

describe("forecast constitution",()=>{
  it("blocks temporal leakage",()=>{
    const r=judgeForecastConstitution({
      pointInTimeValid:false,vintageValid:true,evidenceQuality:.9,
      calibrationQuality:.9,driftRisk:.1,modelDisagreement:.1,
      outcomeCount:100,minimumOutcomes:24,
    });
    expect(r.status).toBe("BLOCK");
    expect(r.confidenceMultiplier).toBe(0);
  });
  it("allows a well-supported calibrated forecast",()=>{
    const r=judgeForecastConstitution({
      pointInTimeValid:true,vintageValid:true,evidenceQuality:.9,
      calibrationQuality:.9,driftRisk:.1,modelDisagreement:.1,
      outcomeCount:100,minimumOutcomes:24,
    });
    expect(r.status).toBe("ALLOW");
    expect(r.confidenceMultiplier).toBeGreaterThan(.8);
  });
});
