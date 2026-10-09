import { describe,expect,it } from "vitest";
import { decisionCertificate } from "./decision-certificate";

describe("decision certificate",()=>{
  it("returns insufficient evidence instead of pretending confidence",()=>{
    const r=decisionCertificate({
      purchasePrice:100,
      fairValue:120,
      expectedReturn:.1,
      downsideCvar:-.1,
      probabilityPositive:.7,
      confidence:.8,
      liquidity:.8,
      modelRisk:.1,
      evidenceQuality:.1,
      negotiationEdge:.05,
    });
    expect(r.status).toBe("INSUFFICIENT_EVIDENCE");
    expect(r.action).toBe("PASS");
  });

  it("exposes a risk-adjusted purchase ceiling",()=>{
    const r=decisionCertificate({
      purchasePrice:100,
      fairValue:140,
      expectedReturn:.12,
      downsideCvar:-.08,
      probabilityPositive:.75,
      confidence:.8,
      liquidity:.8,
      modelRisk:.15,
      evidenceQuality:.8,
      negotiationEdge:.06,
    });
    expect(r.maxSafePurchasePrice).toBeGreaterThan(0);
    expect(r.maxSafePurchasePrice).toBeLessThan(140);
    expect(r.switchingThreshold).toBeGreaterThan(0);
  });

  it("does not hide fragile decisions",()=>{
    const r=decisionCertificate({
      purchasePrice:100,
      fairValue:108,
      expectedReturn:.02,
      downsideCvar:-.18,
      probabilityPositive:.52,
      confidence:.42,
      liquidity:.35,
      modelRisk:.52,
      evidenceQuality:.55,
      negotiationEdge:.02,
    });
    expect(["FRAGILE","UNSTABLE","INSUFFICIENT_EVIDENCE"]).toContain(r.status);
    expect(r.invalidators.length).toBeGreaterThan(0);
  });
});
