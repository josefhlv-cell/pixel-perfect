import {buildFutureKnowledge} from "./future-knowledge-engine";

describe("future knowledge engine",()=>{
  it("compresses correlated evidence and exposes time-to-know",()=>{
    const out=buildFutureKnowledge({
      now:"2026-01-01",
      modelRisk:.1,
      dataCoverage:.9,
      hypotheses:[
        {state:"ACCELERATION",prior:.5,expectedImpact:.8},
        {state:"CORRECTION",prior:.3,expectedImpact:.7},
      ],
      signals:[
        {id:"a",observedAt:"2026-01-01",sourceFamily:"portal-a",independentGroup:"listings",direction:"UP",strength:.8,quality:"HIGH",leadDays:45,persistenceDays:20,mechanism:"inventory",futureStates:["ACCELERATION"],invalidator:"inventory reverses"},
        {id:"b",observedAt:"2026-01-01",sourceFamily:"portal-b",independentGroup:"listings",direction:"UP",strength:.9,quality:"HIGH",leadDays:30,persistenceDays:25,mechanism:"inventory",futureStates:["ACCELERATION"],invalidator:"inventory reverses"},
        {id:"c",observedAt:"2026-01-01",sourceFamily:"credit",independentGroup:"credit",direction:"UP",strength:.7,quality:"MEDIUM",leadDays:60,persistenceDays:15,mechanism:"credit",futureStates:["ACCELERATION"],invalidator:"credit tightens"},
      ],
    });
    expect(out.leadingState).toBe("ACCELERATION");
    expect(out.timeToKnowDays).not.toBeNull();
    expect(out.states[0].independentEvidenceGroups).toBe(2);
    expect(out.audit.length).toBeGreaterThan(0);
  });
});
