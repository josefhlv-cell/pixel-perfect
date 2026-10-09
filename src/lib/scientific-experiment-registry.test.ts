import { describe, expect, it } from "vitest";
import { judgeExperiment } from "./scientific-experiment-registry";

const experiment={
  id:"spatial-vs-baseline",
  hypothesis:"spatial features improve OOS forecasting",
  baseline:"hedonic",
  treatment:"spatial",
  target:"price_growth_12m",
  split:"blocked-time-spatial",
  createdAt:"2026-10-07"
};

describe("scientific experiment registry",()=>{
  it("rejects leakage even when treatment looks better",()=>{
    const r=judgeExperiment(experiment,{
      baselineScore:.7,treatmentScore:.9,delta:.2,leakageFree:false,
      calibrationImproved:true,sampleSize:500,notes:[]
    });
    expect(r.verdict).toBe("REJECTED");
  });

  it("supports a meaningful calibrated improvement",()=>{
    const r=judgeExperiment(experiment,{
      baselineScore:.7,treatmentScore:.85,delta:.15,leakageFree:true,
      calibrationImproved:true,sampleSize:500,notes:[]
    });
    expect(r.verdict).toBe("SUPPORTED");
  });
});
