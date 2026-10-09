import {describe,expect,it} from "vitest";
import {selectForecastStrategy} from "./contextual-forecast-strategy";
import type {ForecastGenomeV2} from "./forecast-genome-v2";

const genome:ForecastGenomeV2={
  cells:[
    {model:"A",submarket:"HRADEC",regime:"EXPANSION",horizonMonths:12,cases:30,weightedError:.1,directionalAccuracy:.9,calibrationRate:.9,trust:.82,status:"CHAMPION_ZONE"},
    {model:"B",submarket:"HRADEC",regime:"EXPANSION",horizonMonths:12,cases:30,weightedError:.2,directionalAccuracy:.8,calibrationRate:.8,trust:.7,status:"CORE_ZONE"},
  ],
  bestByContext:{"HRADEC|EXPANSION|12":"A"},
  fragileContexts:[],
  learningTargets:[],
};

describe("contextual forecast strategy",()=>{
  it("selects a contextual champion",()=>{
    const r=selectForecastStrategy(genome,{submarket:"HRADEC",regime:"EXPANSION",horizonMonths:12});
    expect(r.mode).toBe("CHAMPION");
    expect(r.primaryModel).toBe("A");
  });
  it("blocks unsupported contexts",()=>{
    const r=selectForecastStrategy(genome,{submarket:"BRNO",regime:"CORRECTION",horizonMonths:24});
    expect(r.mode).toBe("INSUFFICIENT_EVIDENCE");
  });
});
