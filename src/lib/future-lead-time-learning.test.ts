import {learnFutureLeadTime} from "./future-lead-time-learning";

describe("future lead-time learning",()=>{
  it("rewards accurate persistent warnings and penalizes false alarms",()=>{
    const cases=Array.from({length:12},(_,i)=>({
      signalId:"inventory",
      sourceFamily:"market",
      issuedAt:`2026-01-${String(i+1).padStart(2,"0")}`,
      targetEventAt:`2026-04-${String(Math.min(28,i+10)).padStart(2,"0")}`,
      predictedDirection:"UP" as const,
      actualDirection:"UP" as const,
      strength:.9,
      falseAlarm:false,
      usefulWarning:true,
      outcomeQuality:.9,
    }));
    const out=learnFutureLeadTime(cases);
    expect(out.bestEarlyWarning).toBe("inventory");
    expect(out.learnedLeadTimeDays).not.toBeNull();
    expect(out.skills[0].status).toBe("CHAMPION");
  });
});
