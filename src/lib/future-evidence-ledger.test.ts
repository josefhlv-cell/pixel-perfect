import { describe,expect,it } from "vitest";
import { replayFutureLedger,updateFutureLedger } from "./future-evidence-ledger";

describe("future evidence ledger",()=>{
  const initial=[
    {id:"A",prior:.5,posterior:.5,support:0,contradiction:0,status:"COMPETING" as const},
    {id:"B",prior:.5,posterior:.5,support:0,contradiction:0,status:"COMPETING" as const},
  ];
  it("moves support toward a hypothesis backed by evidence",()=>{
    const r=updateFutureLedger(initial,{
      id:"e1",observedAt:"2026-10-07",feature:"inventory",
      value:-.1,sourceQuality:.9,reliability:.9,
      likelihoods:{A:3,B:.5}
    });
    expect(r.dominant).toBe("A");
    expect(r.states.find(x=>x.id==="A")!.posterior).toBeGreaterThan(.7);
  });
  it("supports chronological replay",()=>{
    const r=replayFutureLedger(initial,[
      {id:"e1",observedAt:"2026-10-01",feature:"rates",value:-.01,sourceQuality:.9,reliability:.9,likelihoods:{A:2,B:1}},
      {id:"e2",observedAt:"2026-10-05",feature:"inventory",value:-.05,sourceQuality:.9,reliability:.9,likelihoods:{A:2,B:1}},
    ]);
    expect(r.evidence).toHaveLength(2);
    expect(r.dominant).toBe("A");
  });
});
