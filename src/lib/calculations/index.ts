/**
 * Reality Investor — deterministic calculation engine.
 *
 * Pure functions only. No React, no AI, no database.
 * Money: integer CZK (whole Kč) at the API boundary; intermediate math in haléře
 * (1 Kč = 100 h) and rounded back to whole Kč so results are reproducible.
 * Rates: basis points (1 % = 100 bps).
 */

export type CZK = number; // integer, whole crowns
export type Bps = number; // integer basis points

const HALER = 100;
const toH = (czk: CZK) => Math.round(czk * HALER);
const fromH = (h: number) => Math.round(h / HALER);
const bpsToRate = (bps: Bps) => bps / 10_000;

/** Monthly annuity payment (Czech mortgage: fixed monthly annuity). */
export function calculateMortgagePayment(principal: CZK, annualRateBps: Bps, termMonths: number): CZK {
  if (principal <= 0 || termMonths <= 0) return 0;
  const r = bpsToRate(annualRateBps) / 12;
  const p = toH(principal);
  if (r === 0) return fromH(p / termMonths);
  const payment = (p * r) / (1 - Math.pow(1 + r, -termMonths));
  return fromH(payment);
}

export interface AmortizationRow {
  month: number;
  payment: CZK;
  interest: CZK;
  principal: CZK;
  balance: CZK;
}

/** Full amortization schedule (month-by-month). */
export function calculateAmortization(principal: CZK, annualRateBps: Bps, termMonths: number): AmortizationRow[] {
  const rows: AmortizationRow[] = [];
  if (principal <= 0 || termMonths <= 0) return rows;
  const r = bpsToRate(annualRateBps) / 12;
  const paymentH = toH(calculateMortgagePayment(principal, annualRateBps, termMonths));
  let balanceH = toH(principal);
  for (let m = 1; m <= termMonths; m++) {
    const interestH = Math.round(balanceH * r);
    let principalH = paymentH - interestH;
    if (m === termMonths || principalH > balanceH) principalH = balanceH;
    balanceH -= principalH;
    rows.push({
      month: m,
      payment: fromH(principalH + interestH),
      interest: fromH(interestH),
      principal: fromH(principalH),
      balance: fromH(balanceH),
    });
  }
  return rows;
}

/** Remaining loan balance after n months. */
export function calculateDebtBalance(principal: CZK, annualRateBps: Bps, termMonths: number, monthsPaid: number): CZK {
  if (monthsPaid <= 0) return principal;
  const sched = calculateAmortization(principal, annualRateBps, termMonths);
  if (monthsPaid >= sched.length) return 0;
  return sched[monthsPaid - 1].balance;
}

/** Principal repaid over the first n months. */
export function calculateDebtPaydown(principal: CZK, annualRateBps: Bps, termMonths: number, months: number): CZK {
  return principal - calculateDebtBalance(principal, annualRateBps, termMonths, months);
}

/** Loan-to-value in bps. */
export function calculateLTV(loan: CZK, value: CZK): Bps {
  if (value <= 0) return 0;
  return Math.round((loan / value) * 10_000);
}

/** Gross yield (annual rent / price) in bps. */
export function calculateGrossYield(monthlyRent: CZK, price: CZK): Bps {
  if (price <= 0) return 0;
  return Math.round(((monthlyRent * 12) / price) * 10_000);
}

/** Vacancy loss for a month. */
export function calculateVacancy(monthlyRent: CZK, vacancyBps: Bps): CZK {
  return fromH(toH(monthlyRent) * bpsToRate(vacancyBps));
}

export interface OperatingExpenseInput {
  hoaFund?: CZK; // fond oprav / SVJ (monthly, owner part)
  insurance?: CZK; // monthly
  propertyTaxYearly?: CZK; // daň z nemovitých věcí (yearly)
  maintenance?: CZK; // monthly reserve
  management?: CZK; // monthly
  other?: CZK; // monthly
}

/** Monthly operating expenses. */
export function calculateOperatingExpenses(e: OperatingExpenseInput): CZK {
  const monthly =
    (e.hoaFund ?? 0) + (e.insurance ?? 0) + (e.maintenance ?? 0) + (e.management ?? 0) + (e.other ?? 0);
  return monthly + Math.round((e.propertyTaxYearly ?? 0) / 12);
}

/** Net yield (NOI / total acquisition cost) in bps. */
export function calculateNetYield(
  monthlyRent: CZK,
  vacancyBps: Bps,
  monthlyExpenses: CZK,
  totalCost: CZK,
): Bps {
  if (totalCost <= 0) return 0;
  const noiMonthly = monthlyRent - calculateVacancy(monthlyRent, vacancyBps) - monthlyExpenses;
  return Math.round(((noiMonthly * 12) / totalCost) * 10_000);
}

/** Monthly cash flow after debt service. */
export function calculateCashFlow(
  monthlyRent: CZK,
  vacancyBps: Bps,
  monthlyExpenses: CZK,
  monthlyMortgage: CZK,
): CZK {
  return monthlyRent - calculateVacancy(monthlyRent, vacancyBps) - monthlyExpenses - monthlyMortgage;
}

/** Annual pre-tax cash flow / cash invested, in bps. */
export function calculateCashOnCash(monthlyCashFlow: CZK, cashInvested: CZK): Bps {
  if (cashInvested <= 0) return 0;
  return Math.round(((monthlyCashFlow * 12) / cashInvested) * 10_000);
}

/** Compound growth of a value over years. */
export function calculatePropertyValueGrowth(value: CZK, annualGrowthBps: Bps, years: number): CZK {
  return Math.round(value * Math.pow(1 + bpsToRate(annualGrowthBps), years));
}

/** Appreciation (gain) in CZK over years. */
export function calculateAppreciation(value: CZK, annualGrowthBps: Bps, years: number): CZK {
  return calculatePropertyValueGrowth(value, annualGrowthBps, years) - value;
}

/** Rent after N years of growth. */
export function calculateRentGrowth(monthlyRent: CZK, annualGrowthBps: Bps, years: number): CZK {
  return Math.round(monthlyRent * Math.pow(1 + bpsToRate(annualGrowthBps), years));
}

/** Equity = value − debt. */
export function calculateEquity(value: CZK, debt: CZK): CZK {
  return value - debt;
}

/** Simple ROI in bps: (gain) / invested. */
export function calculateROI(totalGain: CZK, invested: CZK): Bps {
  if (invested <= 0) return 0;
  return Math.round((totalGain / invested) * 10_000);
}

/**
 * IRR of periodic cash flows (index 0 = initial, usually negative).
 * Returns rate per period in bps, or null if it does not converge / undefined.
 */
export function calculateIRR(cashFlows: number[], guess = 0.1): Bps | null {
  if (cashFlows.length < 2) return null;
  const hasNeg = cashFlows.some((c) => c < 0);
  const hasPos = cashFlows.some((c) => c > 0);
  if (!hasNeg || !hasPos) return null;
  const npv = (r: number) => cashFlows.reduce((acc, c, t) => acc + c / Math.pow(1 + r, t), 0);
  // Newton-Raphson with bisection fallback
  let r = guess;
  for (let i = 0; i < 100; i++) {
    const f = npv(r);
    const d = cashFlows.reduce((acc, c, t) => acc - (t * c) / Math.pow(1 + r, t + 1), 0);
    if (d === 0) break;
    const next = r - f / d;
    if (!Number.isFinite(next) || next <= -0.9999) break;
    if (Math.abs(next - r) < 1e-10) return Math.round(next * 10_000);
    r = next;
  }
  let lo = -0.9999;
  let hi = 10;
  if (npv(lo) * npv(hi) > 0) return null;
  for (let i = 0; i < 300; i++) {
    const mid = (lo + hi) / 2;
    const v = npv(mid);
    if (Math.abs(v) < 1e-6) return Math.round(mid * 10_000);
    if (npv(lo) * v < 0) hi = mid;
    else lo = mid;
  }
  return Math.round(((lo + hi) / 2) * 10_000);
}

// ---------- Full investment model ----------

export interface InvestmentInput {
  purchasePrice: CZK;
  closingCosts: CZK; // provize, právní služby, odhad, vklad do KN
  renovation: CZK;
  ltvBps: Bps; // loan as share of purchase price
  interestRateBps: Bps;
  termMonths: number;
  monthlyRent: CZK;
  vacancyBps: Bps;
  monthlyExpenses: CZK;
  appreciationBps: Bps; // yearly
  rentGrowthBps: Bps; // yearly
  holdingYears: number;
  saleCostsBps: Bps; // on exit
}

export interface InvestmentResult {
  loan: CZK;
  downPayment: CZK;
  cashInvested: CZK;
  totalCost: CZK;
  ltvBps: Bps;
  monthlyMortgage: CZK;
  monthlyCashFlow: CZK;
  grossYieldBps: Bps;
  netYieldBps: Bps;
  cashOnCashBps: Bps;
  exitValue: CZK;
  exitDebt: CZK;
  exitEquity: CZK;
  totalReturn: CZK;
  roiBps: Bps;
  irrBps: Bps | null;
  yearly: { year: number; value: CZK; debt: CZK; equity: CZK; cashFlow: CZK; rent: CZK }[];
}

export function calculateTotalReturn(input: InvestmentInput): InvestmentResult {
  const loan = Math.round(input.purchasePrice * bpsToRate(input.ltvBps));
  const downPayment = input.purchasePrice - loan;
  const cashInvested = downPayment + input.closingCosts + input.renovation;
  const totalCost = input.purchasePrice + input.closingCosts + input.renovation;
  const monthlyMortgage = calculateMortgagePayment(loan, input.interestRateBps, input.termMonths);
  const monthlyCashFlow = calculateCashFlow(input.monthlyRent, input.vacancyBps, input.monthlyExpenses, monthlyMortgage);

  const yearly: InvestmentResult["yearly"] = [];
  const flows: number[] = [-cashInvested];
  let cumulativeCash = 0;
  const years = Math.max(1, Math.round(input.holdingYears));
  for (let y = 1; y <= years; y++) {
    const rent = calculateRentGrowth(input.monthlyRent, input.rentGrowthBps, y - 1);
    const expenses = Math.round(input.monthlyExpenses * Math.pow(1 + bpsToRate(input.rentGrowthBps), y - 1));
    const cf = calculateCashFlow(rent, input.vacancyBps, expenses, monthlyMortgage) * 12;
    cumulativeCash += cf;
    const value = calculatePropertyValueGrowth(input.purchasePrice + input.renovation, input.appreciationBps, y);
    const debt = calculateDebtBalance(loan, input.interestRateBps, input.termMonths, y * 12);
    yearly.push({ year: y, value, debt, equity: value - debt, cashFlow: cf, rent });
    flows.push(cf);
  }
  const last = yearly[yearly.length - 1];
  const saleCosts = Math.round(last.value * bpsToRate(input.saleCostsBps));
  const exitEquity = last.value - last.debt - saleCosts;
  flows[flows.length - 1] += exitEquity;
  const totalReturn = cumulativeCash + exitEquity - cashInvested;

  return {
    loan,
    downPayment,
    cashInvested,
    totalCost,
    ltvBps: calculateLTV(loan, input.purchasePrice),
    monthlyMortgage,
    monthlyCashFlow,
    grossYieldBps: calculateGrossYield(input.monthlyRent, input.purchasePrice),
    netYieldBps: calculateNetYield(input.monthlyRent, input.vacancyBps, input.monthlyExpenses, totalCost),
    cashOnCashBps: calculateCashOnCash(monthlyCashFlow, cashInvested),
    exitValue: last.value,
    exitDebt: last.debt,
    exitEquity,
    totalReturn,
    roiBps: calculateROI(totalReturn, cashInvested),
    irrBps: calculateIRR(flows),
    yearly,
  };
}

export interface StressInput {
  rateShockBps: Bps; // + to interest
  rentShockBps: Bps; // − share of rent (e.g. 1000 = −10 %)
  vacancyShockBps: Bps; // + to vacancy
  valueShockBps: Bps; // − share of value growth (applied to appreciation as absolute bps)
}

/** Re-run the model with adverse shocks. */
export function calculateStressScenario(input: InvestmentInput, s: StressInput): InvestmentResult {
  return calculateTotalReturn({
    ...input,
    interestRateBps: input.interestRateBps + s.rateShockBps,
    monthlyRent: Math.round(input.monthlyRent * (1 - bpsToRate(s.rentShockBps))),
    vacancyBps: Math.min(10_000, input.vacancyBps + s.vacancyShockBps),
    appreciationBps: input.appreciationBps - s.valueShockBps,
  });
}

/** Czech defaults used to prefill the calculator. Not market data. */
export const DEFAULT_ASSUMPTIONS = {
  ltvBps: 8000,
  interestRateBps: 489,
  termMonths: 360,
  vacancyBps: 500,
  appreciationBps: 300,
  rentGrowthBps: 250,
  holdingYears: 10,
  saleCostsBps: 300,
  closingCostsBps: 300,
} as const;
