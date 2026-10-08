import {buildFutureRadar} from "./future-radar-core";

describe("future radar core",()=>{
 it("marks close competing futures as contested",()=>{
  const r=buildFutureRadar({
   claims:[{id:"c1",family:"credit",direction:"UP",strength:.7,observedAt:"2026-01-01",independentGroup:"credit"}],
   hypotheses:[
    {id:"A",prior:.5,expected:[{family:"credit",direction:"UP",weight:1}],invalidators:["credit reverses"]},
    {id:"B",prior:.5,expected:[{family:"credit",direction:"UP",weight:.98}],invalidators:["credit reverses"]},
   ],
   observations:[{id:"credit-update",family:"credit",cost:10,latencyDays:7,reliability:.9,hypotheses:["A","B"],expectedDiscrimination:.9}]
  });
  expect(r.state).toBe("CONTESTED");
  expect(r.nextBestObservation).toBe("credit-update");
 });
});
