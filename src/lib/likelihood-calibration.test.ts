import {describe,expect,it} from "vitest";
import {calibrateLikelihoodRatios} from "./likelihood-calibration";

describe("likelihood calibration",()=>{
  it("shrinks small samples toward neutral",()=>{
    const r=calibrateLikelihoodRatios([
      ...Array.from({length:5},(_,i)=>({
        signal:"credit",hypothesis:"ACCELERATION",regime:"EXPANSION",
        evidencePresent:true,outcomeSupported:true,weight:1+i*.1,
      })),
    ]);
    expect(r[0]?.status).toBe("INSUFFICIENT_DATA");
    expect(r[0]?.likelihoodRatio).toBeLessThan(5);
  });

  it("learns a stable empirical likelihood ratio with enough cases",()=>{
    const cases=[
      ...Array.from({length:40},()=>({
        signal:"inventory",hypothesis:"CORRECTION",regime:"DECELERATION",
        evidencePresent:true,outcomeSupported:true,weight:1,
      })),
      ...Array.from({length:40},()=>({
        signal:"inventory",hypothesis:"CORRECTION",regime:"DECELERATION",
        evidencePresent:false,outcomeSupported:false,weight:1,
      })),
    ];
    const r=calibrateLikelihoodRatios(cases);
    expect(r[0]?.status).toBe("EMPIRICALLY_CALIBRATED");
    expect(r[0]?.likelihoodRatio).toBeGreaterThan(1);
  });
});
