import {describe,expect,it} from "vitest";
import {fuseEvidenceClaims} from "./evidence-fusion-gate";

describe("evidence fusion gate",()=>{
  it("does not count copied sources as independent evidence",()=>{
    const r=fuseEvidenceClaims([
      {id:"1",claimKey:"rate-cut",source:"A",sourceFamily:"NEWS",publishedAt:"2026-01-01",reliability:.8,direction:"POSITIVE",strength:.8},
      {id:"2",claimKey:"rate-cut",source:"B",sourceFamily:"NEWS",publishedAt:"2026-01-01",reliability:.7,direction:"POSITIVE",strength:.7},
      {id:"3",claimKey:"rate-cut",source:"C",sourceFamily:"CENTRAL_BANK",publishedAt:"2026-01-01",reliability:.95,direction:"POSITIVE",strength:.9},
    ]);
    expect(r[0]?.effectiveEvidenceCount).toBe(2);
    expect(r[0]?.independentSourceFamilies).toBe(2);
  });
  it("detects genuine conflict across source families",()=>{
    const r=fuseEvidenceClaims([
      {id:"1",claimKey:"demand",source:"bank",sourceFamily:"BANK",publishedAt:"2026-01-01",reliability:.9,direction:"POSITIVE",strength:.8},
      {id:"2",claimKey:"demand",source:"official",sourceFamily:"OFFICIAL",publishedAt:"2026-01-01",reliability:.9,direction:"NEGATIVE",strength:.8},
    ]);
    expect(r[0]?.dominantDirection).toBe("CONFLICTED");
  });
});
