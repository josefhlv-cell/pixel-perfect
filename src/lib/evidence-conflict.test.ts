import { describe,expect,it } from "vitest";
import { assessEvidenceConflict } from "./evidence-conflict";

describe("evidence conflict",()=>{
  const now=1_000_000_000;
  it("recognises coherent evidence",()=>{
    const r=assessEvidenceConflict([
      {sourceId:"czso",kind:"TRANSACTION",value:100,weight:1,observedAt:now,availableAt:now,reliability:1},
      {sourceId:"cuzk",kind:"TRANSACTION",value:102,weight:1,observedAt:now,availableAt:now,reliability:.95}
    ],now);
    expect(r.action).toBe("NONE");
    expect(r.sourceCount).toBe(2);
  });
  it("downweights stale or conflicting evidence",()=>{
    const r=assessEvidenceConflict([
      {sourceId:"a",kind:"ASKING",value:100,weight:1,observedAt:now,availableAt:now,reliability:.8},
      {sourceId:"b",kind:"TRANSACTION",value:160,weight:1,observedAt:now,availableAt:now,reliability:1},
      {sourceId:"c",kind:"MACRO",value:95,weight:1,observedAt:now-100_000_000,availableAt:now-100_000_000,reliability:.9}
    ],now);
    expect(r.conflictScore).toBeGreaterThan(.25);
    expect(r.staleShare).toBeGreaterThan(0);
  });
});
