import { describe, expect, it } from "vitest";
import { adversarialCritique, judgeForecast, pointInTimeEvidence } from "./prediction-judge";

describe("prediction judge",()=>{
  const evidence=[{
    id:"tx-1",kind:"TRANSACTION" as const,observedAt:"2026-01-01",availableAt:"2026-01-10",
    quality:.9,direction:.2,relevance:1
  },{
    id:"ask-1",kind:"ASKING" as const,observedAt:"2026-02-01",availableAt:"2026-02-02",
    quality:.6,direction:.4,relevance:.8
  }];

  it("enforces point-in-time availability",()=>{
    expect(pointInTimeEvidence(evidence,"2026-01-31")).toHaveLength(1);
  });

  it("rejects leaked forecasts",()=>{
    const r=judgeForecast({
      models:[{model:"x",oosScore:.9,calibration:.9,coverage:.9,drift:.1,spatialValidity:.9,sampleSize:100}],
      evidence,
      modelAgreement:.9,regimeConfidence:.9,dataFreshness:.9,
      leakageDetected:true,transactionShare:.8
    });
    expect(r.status).toBe("REJECT");
    expect(r.blockers.length).toBeGreaterThan(0);
  });

  it("produces adversarial failure modes instead of unconditional confidence",()=>{
    const critique=adversarialCritique({
      models:[{model:"x",oosScore:.8,calibration:.8,coverage:.7,drift:.5,spatialValidity:.5,sampleSize:100}],
      evidence,
      modelAgreement:.4,regimeConfidence:.4,dataFreshness:.5,
      leakageDetected:false,transactionShare:.2
    });
    expect(critique.length).toBeGreaterThan(2);
  });
});
