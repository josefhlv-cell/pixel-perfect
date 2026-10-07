import { describe, expect, it } from "vitest";
import { auditReplayLeakage, isReplayValid, replayInformation, buildReplayWindows } from "./historical-replay";

describe("historical replay",()=>{
  const rows=[
    {id:"a",eventTime:"2025-01-01",availableAt:"2025-01-02",value:100,kind:"PRICE",source:"tx"},
    {id:"b",eventTime:"2025-02-01",availableAt:"2025-03-05",value:105,kind:"PRICE",source:"tx"},
    {id:"c",eventTime:"2025-04-01",availableAt:"2025-04-02",value:110,kind:"PRICE",source:"tx"}
  ];

  it("hides information unavailable at the historical cutoff",()=>{
    const w=replayInformation(rows,"2025-02-15");
    expect(w.visible.map(x=>x.id)).toEqual(["a"]);
    expect(w.excludedFuture.map(x=>x.id)).toEqual(["b","c"]);
    expect(auditReplayLeakage(w)).toHaveLength(0);
    expect(isReplayValid(w)).toBe(true);
  });

  it("builds forward replay windows",()=>{
    const w=buildReplayWindows(rows,["2025-02-15"],12)[0]!;
    expect(w.horizonEnd.startsWith("2026-02-15")).toBe(true);
  });
});
