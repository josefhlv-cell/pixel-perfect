import {describe,it,expect} from "vitest";
import {selectForecastStrategy} from "./adaptive-forecast-constitution";

describe("adaptive forecast constitution",()=>{
 it("falls back to caution under drift",()=>{
  const r=selectForecastStrategy([{strategy:"LOCAL",oosLoss:.1,directionalAccuracy:.7,calibration:.8,sampleSize:100,regimeMatch:.8,spatialMatch:.8}],{driftRisk:.8,modelDisagreement:.1,spatialDensity:.8});
  expect(r.strategy).toBe("CAUTIOUS");
 });
 it("uses local when connected evidence conflicts with sparse space",()=>{
  const r=selectForecastStrategy([{strategy:"CONNECTED",oosLoss:.1,directionalAccuracy:.8,calibration:.8,sampleSize:100,regimeMatch:.8,spatialMatch:.8}],{driftRisk:.1,modelDisagreement:.1,spatialDensity:.1});
  expect(r.strategy).toBe("LOCAL");
 });
});
