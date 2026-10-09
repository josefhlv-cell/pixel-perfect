import {describe,it,expect} from "vitest";
import {runHistoricalReplayV2} from "./historical-replay-v2";

describe("historical replay v2",()=>{
 it("keeps future observations out of training",()=>{
  const rows=[
   {id:"a",eventTime:"2020-01-01",availableAt:"2020-01-02",value:100},
   {id:"b",eventTime:"2020-02-01",availableAt:"2020-02-02",value:105},
   {id:"c",eventTime:"2020-03-01",availableAt:"2020-03-02",value:110},
  ];
  const vintages=rows.map((r,i)=>({id:r.id,source:"test",series:"price",referencePeriod:r.eventTime,publishedAt:r.availableAt,value:r.value,revision:i}));
  const r=runHistoricalReplayV2({
   rows,vintages,cutoffs:["2020-02-15"],horizonMonths:1,
   forecast:training=>({predicted:training.at(-1)!.value+5,lower:100,upper:120,modelVersion:"test"}),
   outcome:()=>115,
  });
  expect(r.pointInTimeIntegrity).toBe(true);
  expect(r.cases[0]!.trainingRows).toBe(2);
  expect(r.cases[0]!.outcome).toBe(115);
 });
});
