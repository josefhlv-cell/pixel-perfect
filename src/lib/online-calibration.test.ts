import { describe,expect,it } from "vitest";
import { calibratedInterval,calibrationTrust,updateOnlineCalibration } from "./online-calibration";

describe("online calibration",()=>{
  it("learns persistent forecast bias",()=>{
    let s={bias:0,radius:.05,alpha:.1,updates:0};
    for(let i=0;i<30;i++)s=updateOnlineCalibration(s,.05,.10);
    expect(s.bias).toBeGreaterThan(0);
    const x=calibratedInterval(s,.05);
    expect(x.center).toBeGreaterThan(.05);
    expect(x.high).toBeGreaterThan(x.low);
  });
  it("does not claim strong trust with little evidence",()=>{
    const s={bias:0,radius:.05,alpha:.1,updates:2};
    expect(calibrationTrust(s)).toBeLessThan(.2);
  });
});
