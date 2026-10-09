import { describe,expect,it } from "vitest";
import { buildForecastGenome } from "./forecast-genome";

describe("forecast genome",()=>{
  it("learns the stronger model by submarket and regime",()=>{
    const rows=[
      ...Array.from({length:10},(_,i)=>({model:"A",submarket:"PRG",regime:"EXPANSION",horizonMonths:12,predicted:.10,actual:.10+i*.0001,timestamp:i})),
      ...Array.from({length:10},(_,i)=>({model:"B",submarket:"PRG",regime:"EXPANSION",horizonMonths:12,predicted:.02,actual:.10+i*.0001,timestamp:i})),
    ];
    const g=buildForecastGenome(rows,8);
    expect(g.bestBySubmarket.PRG).toBe("A");
    expect(g.bestByRegime.EXPANSION).toBe("A");
    expect(g.recommendedWeights.A).toBeGreaterThan(g.recommendedWeights.B);
  });
});
