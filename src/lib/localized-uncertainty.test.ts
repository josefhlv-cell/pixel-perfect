import { describe,expect,it } from "vitest";
import { localizedUncertainty } from "./localized-uncertainty";

describe("localized uncertainty",()=>{
  it("weights local and feature-similar evidence",()=>{
    const r=localizedUncertainty([
      {id:"near",lat:50.08,lon:14.43,featureVector:[1,1,1],residual:1000,observedAt:"2026-09-01",sourceQuality:.9},
      {id:"far",lat:49.20,lon:16.61,featureVector:[8,8,8],residual:10000,observedAt:"2024-01-01",sourceQuality:.5},
    ],{
      lat:50.081,lon:14.431,featureVector:[1,1,1],
      asOf:"2026-10-01",basePrediction:100000
    });
    expect(r.effectiveSampleSize).toBeGreaterThan(0);
    expect(r.strongestEvidence[0]).toContain("near");
    expect(r.lower).toBeLessThan(r.upper);
  });
});
