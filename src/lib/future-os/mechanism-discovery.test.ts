import { describe, expect, it } from "vitest";
import { discoverMechanisms } from "./mechanism-discovery";

function makeSeries(fn:(i:number)=>number) {
  return Array.from({length:24},(_,i)=>({
    date:new Date(Date.UTC(2020,0,1+i*30)).toISOString(),
    value:fn(i),
  }));
}

describe("Future OS mechanism discovery",()=>{
  it("finds a stable lagged candidate",()=>{
    const source=makeSeries(i=>i);
    const target=makeSeries(i=>i-3);
    const results=discoverMechanisms({rates:source},{prices:target},[90]);
    expect(results[0]!.status).toBe("PROMISING");
    expect(results[0]!.correlation).toBeGreaterThan(0.9);
  });

  it("does not manufacture a mechanism from too little data",()=>{
    const short=makeSeries(i=>i).slice(0,5);
    expect(discoverMechanisms({a:short},{b:short},[30])).toHaveLength(0);
  });
});
