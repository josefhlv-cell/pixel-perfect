import { describe, expect, it } from "vitest";
import { aggregateForecast, initializeModelPortfolio, updateModelPortfolio } from "./adaptive-model-aggregation";

describe("adaptive model aggregation",()=>{
  it("moves weight toward lower-loss models",()=>{
    const initial=initializeModelPortfolio(["a","b"]);
    const next=updateModelPortfolio(initial,[
      {model:"a",loss:.1,availableAt:"2026-01-01",horizonMonths:1},
      {model:"b",loss:.9,availableAt:"2026-01-01",horizonMonths:1},
    ],{learningRate:.5});
    expect(next.find(x=>x.name==="a")!.weight).toBeGreaterThan(next.find(x=>x.name==="b")!.weight);
  });

  it("aggregates quantiles without collapsing uncertainty",()=>{
    const p=initializeModelPortfolio(["a","b"]);
    const r=aggregateForecast([
      {model:"a",p10:-100,p50:100,p90:300,confidence:.8},
      {model:"b",p10:-200,p50:50,p90:250,confidence:.6}
    ],p);
    expect(r.p10).toBeLessThan(r.p50);
    expect(r.p50).toBeLessThan(r.p90);
    expect(r.confidence).toBeGreaterThan(0);
  });
});
