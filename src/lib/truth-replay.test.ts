import {describe,expect,it} from "vitest";
import {replayTruth} from "./truth-replay";

describe("truth replay",()=>{
  it("excludes transactions published after the cutoff",()=>{
    const r=replayTruth([
      {id:"old",geography:"CZ",period:"2025",metric:"PRICE_M2",value:60000,
       truthLevel:"TRANSACTION",eventTime:"2025-06-01",availableAt:"2025-08-01",
       source:"CZSO/CUZK",reliability:.95},
      {id:"late",geography:"CZ",period:"2025",metric:"PRICE_M2",value:65000,
       truthLevel:"TRANSACTION",eventTime:"2025-06-15",availableAt:"2026-02-01",
       source:"CZSO/CUZK",reliability:.95},
      {id:"future",geography:"CZ",period:"2026",metric:"PRICE_M2",value:70000,
       truthLevel:"TRANSACTION",eventTime:"2026-06-01",availableAt:"2026-08-01",
       source:"CZSO/CUZK",reliability:.95},
    ],"2025-09-01");
    expect(r.usable.map(x=>x.id)).toEqual(["old"]);
    expect(r.excludedAfterCutoff).toBe(1);
    expect(r.excludedFuture).toBe(1);
  });
});
