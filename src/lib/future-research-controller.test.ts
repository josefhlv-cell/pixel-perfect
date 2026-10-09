import {describe,it,expect} from "vitest";
import {runFutureResearchController} from "./future-research-controller";

describe("future research controller",()=>{
 it("caps confidence when governance is weak",()=>{
  const r=runFutureResearchController({
   candidates:[{
    id:"transactions",family:"TRANSACTIONS",source:"official",
    expectedUncertaintyReduction:.8,expectedDecisionImpact:.9,
    modelDisagreementReduction:.7,reliability:.95,freshness:.9,
    cost:.1,latencyHours:2,coverage:.8,reason:"high truth",
   }],
   evidence:[
    {id:"a",claimKey:"prices",source:"a",sourceFamily:"official",publishedAt:"2026-01-01",reliability:.9,direction:"POSITIVE",strength:.8},
    {id:"b",claimKey:"prices",source:"b",sourceFamily:"portal",publishedAt:"2026-01-01",reliability:.8,direction:"NEGATIVE",strength:.8},
   ],
   signalVelocity:[
    {id:"dom",metric:"dom",value:.2,previous:.1,baseline:.05,direction:"UP",reliability:.9,observedAt:"2026-01-01"},
    {id:"credit",metric:"credit",value:.01,previous:.03,baseline:.04,direction:"DOWN",reliability:.9,observedAt:"2026-01-01"},
    {id:"inventory",metric:"inventory",value:.1,previous:.05,baseline:.02,direction:"UP",reliability:.9,observedAt:"2026-01-01"},
   ],
   constitution:{
    pointInTimeValid:true,vintageValid:true,evidenceQuality:.5,calibrationQuality:.4,
    driftRisk:.2,modelDisagreement:.2,outcomeCount:2,minimumOutcomes:20,
   },
  });
  expect(r.confidenceCap).toBeLessThanOrEqual(.85);
  expect(r.nextBestAction.length).toBeGreaterThan(0);
 });
});
