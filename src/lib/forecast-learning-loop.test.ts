import {describe,expect,it} from "vitest";
import {runForecastLearningLoop} from "./forecast-learning-loop";

describe("forecast learning loop",()=>{
  it("defers immature feedback and learns from matured outcomes",()=>{
    const cases=Array.from({length:20},(_,i)=>({
      forecastId:"f"+i,modelId:"model-a",issuedAt:"2025-01-01",
      outcomeAvailableAt:"2025-06-01",currentTime:"2026-01-01",
      score:.9,calibrationScore:.9,regime:"EXPANSION",
      submarket:"HRADEC",outcomeQuality:.9,
    }));
    cases.push({
      forecastId:"future",modelId:"model-a",issuedAt:"2026-01-01",
      outcomeAvailableAt:"2027-01-01",currentTime:"2026-01-01",
      score:1,calibrationScore:1,regime:"EXPANSION",
      submarket:"HRADEC",outcomeQuality:1,
    });
    const r=runForecastLearningLoop(cases,20);
    expect(r.eligible).toBe(20);
    expect(r.deferred).toBe(1);
    expect(r.states[0]?.status).toBe("STABLE");
  });
});
