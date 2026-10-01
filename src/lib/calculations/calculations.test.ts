import { describe, expect, it } from "vitest";
import {
  calculateAmortization,
  calculateAppreciation,
  calculateCashFlow,
  calculateDebtBalance,
  calculateEquity,
  calculateGrossYield,
  calculateIRR,
  calculateLTV,
  calculateMortgagePayment,
  calculateNetYield,
  calculateROI,
  calculateStressScenario,
  calculateTotalReturn,
  type InvestmentInput,
} from "./index";

const base: InvestmentInput = {
  purchasePrice: 4_290_000,
  closingCosts: 100_000,
  renovation: 0,
  ltvBps: 8000,
  interestRateBps: 489,
  termMonths: 360,
  monthlyRent: 18_500,
  vacancyBps: 500,
  monthlyExpenses: 3_000,
  appreciationBps: 300,
  rentGrowthBps: 250,
  holdingYears: 10,
  saleCostsBps: 300,
};

describe("mortgage", () => {
  it("annuity payment for 3.432M @ 4.89 % / 30y", () => {
    expect(calculateMortgagePayment(3_432_000, 489, 360)).toBe(18_194);
  });
  it("zero rate divides evenly", () => {
    expect(calculateMortgagePayment(360_000, 0, 360)).toBe(1_000);
  });
  it("invalid inputs → 0", () => {
    expect(calculateMortgagePayment(0, 489, 360)).toBe(0);
  });
});

describe("amortization", () => {
  it("ends at zero balance and principal sums to loan", () => {
    const s = calculateAmortization(1_000_000, 500, 120);
    expect(s).toHaveLength(120);
    expect(s[119].balance).toBe(0);
    const sum = s.reduce((a, r) => a + r.principal, 0);
    expect(Math.abs(sum - 1_000_000)).toBeLessThanOrEqual(120);
  });
  it("balance decreases", () => {
    expect(calculateDebtBalance(1_000_000, 500, 120, 60)).toBeLessThan(1_000_000);
  });
});

describe("ratios", () => {
  it("LTV", () => expect(calculateLTV(3_432_000, 4_290_000)).toBe(8000));
  it("gross yield", () => expect(calculateGrossYield(18_500, 4_290_000)).toBe(517));
  it("net yield", () => expect(calculateNetYield(18_500, 500, 3_000, 4_390_000)).toBe(398));
  it("cash flow", () => expect(calculateCashFlow(18_500, 500, 3_000, 18_194)).toBe(-3_619));
  it("ROI", () => expect(calculateROI(500_000, 1_000_000)).toBe(5000));
  it("equity", () => expect(calculateEquity(5_000_000, 3_000_000)).toBe(2_000_000));
  it("appreciation 3 % over 10y", () => expect(calculateAppreciation(1_000_000, 300, 10)).toBe(343_916));
});

describe("IRR", () => {
  it("simple 10 %", () => expect(calculateIRR([-1000, 1100])).toBe(1000));
  it("multi-period", () => {
    const r = calculateIRR([-1000, 300, 400, 500])!;
    expect(r).toBeGreaterThan(880);
    expect(r).toBeLessThan(900);
  });
  it("undefined without sign change", () => expect(calculateIRR([100, 100])).toBeNull());
});

describe("total return & stress", () => {
  it("model is consistent", () => {
    const r = calculateTotalReturn(base);
    expect(r.loan).toBe(3_432_000);
    expect(r.cashInvested).toBe(958_000);
    expect(r.yearly).toHaveLength(10);
    expect(r.exitEquity).toBeGreaterThan(0);
    expect(r.irrBps).not.toBeNull();
  });
  it("stress scenario is worse", () => {
    const b = calculateTotalReturn(base);
    const s = calculateStressScenario(base, { rateShockBps: 200, rentShockBps: 1000, vacancyShockBps: 500, valueShockBps: 300 });
    expect(s.monthlyCashFlow).toBeLessThan(b.monthlyCashFlow);
    expect(s.totalReturn).toBeLessThan(b.totalReturn);
  });
});
