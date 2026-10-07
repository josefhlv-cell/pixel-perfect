import { describe,expect,it } from "vitest";
import { evaluateEarlyWarnings } from "./early-warning-lead-time";

describe("early warning lead time",()=>{
  it("rewards persistent warnings before an event",()=>{
    const r=evaluateEarlyWarnings([
      {observedAt:"2026-01-01",score:.7,severity:"ALERT"},
      {observedAt:"2026-01-20",score:.8,severity:"CRITICAL"},
      {observedAt:"2026-02-01",score:.9,severity:"CRITICAL"},
    ],[
      {id:"e1",occurredAt:"2026-02-15",kind:"CORRECTION"}
    ]);
    expect(r.events[0]!.leadDays).toBe(45);
    expect(r.events[0]!.useful).toBe(true);
    expect(r.medianLeadDays).toBe(45);
  });

  it("does not count missing warnings as successful forecasts",()=>{
    const r=evaluateEarlyWarnings([],[
      {id:"e1",occurredAt:"2026-02-15",kind:"REGIME_SHIFT"}
    ]);
    expect(r.usefulWarningRate).toBe(0);
    expect(r.falseAlarmRate).toBe(1);
  });
});
