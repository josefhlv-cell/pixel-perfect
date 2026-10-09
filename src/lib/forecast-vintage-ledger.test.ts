import {describe,expect,it} from "vitest";
import {auditForecastVintage,buildForecastVintage} from "./forecast-vintage-ledger";

describe("forecast vintage ledger",()=>{
  const vintages=[
    {id:"v1",source:"CZSO",series:"price",referencePeriod:"2025-Q1",publishedAt:"2025-05-01",value:100,revision:0},
    {id:"v2",source:"CZSO",series:"price",referencePeriod:"2025-Q1",publishedAt:"2025-09-01",value:103,revision:1},
  ];
  it("freezes the information set at the forecast cutoff",()=>{
    const f=buildForecastVintage("2025-06-01","2025-06-01","ds-1",["obs-1"],vintages,"predictive-v6.1");
    expect(f.sourceVintages).toEqual(["v1"]);
    const a=auditForecastVintage(f,vintages);
    expect(a.valid).toBe(true);
    expect(a.futureInformation).toBe(1);
  });
  it("detects a missing source vintage",()=>{
    const f=buildForecastVintage("2025-06-01","2025-06-01","ds-1",["obs-1"],vintages,"m");
    const a=auditForecastVintage({...f,sourceVintages:["missing"]},vintages);
    expect(a.valid).toBe(false);
    expect(a.missingVintage).toBe(1);
  });
});
