import { describe, expect, it } from "vitest";
import { buyerRobustness, evaluateBuyer } from "./counterfactual-buyer-lab";

const property={
  price:7000000,fairValue:7600000,p10Value:6500000,p90Value:8300000,
  annualRent:360000,expectedAppreciation:.05,probabilityPositive:.72
};

describe("counterfactual buyer lab",()=>{
  it("changes decisions when financing and risk assumptions change",()=>{
    const cash=evaluateBuyer(property,{
      profile:"CASH_INVESTOR",ltv:0,interestRate:.05,horizonYears:10,
      riskAversion:.25,vacancyRate:.05,rentGrowth:.025
    });
    const leveraged=evaluateBuyer(property,{
      profile:"LOW_RISK_INVESTOR",ltv:.80,interestRate:.065,horizonYears:5,
      riskAversion:.85,vacancyRate:.08,rentGrowth:.015
    });
    expect(cash.utilityBps).not.toBe(leveraged.utilityBps);
  });

  it("identifies robust opportunities across buyer scenarios",()=>{
    const out=buyerRobustness(property,[
      {profile:"CASH_INVESTOR",ltv:0,interestRate:.05,horizonYears:10,riskAversion:.25,vacancyRate:.05,rentGrowth:.025},
      {profile:"VALUE_INVESTOR",ltv:.50,interestRate:.055,horizonYears:10,riskAversion:.40,vacancyRate:.05,rentGrowth:.02},
      {profile:"INCOME_INVESTOR",ltv:.70,interestRate:.06,horizonYears:8,riskAversion:.50,vacancyRate:.07,rentGrowth:.02},
    ]);
    expect(out.decisions).toHaveLength(3);
    expect(Number.isFinite(out.averageUtility)).toBe(true);
  });
});
