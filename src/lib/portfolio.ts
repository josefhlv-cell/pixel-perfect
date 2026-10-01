/** Portfolio aggregation built on the existing calculation engine primitives. */
import { calculateCashFlow, calculateDebtBalance, calculateGrossYield, calculateMortgagePayment } from "./calculations";
import type { Database } from "@/integrations/supabase/types";

export type PortfolioRow = Database["public"]["Tables"]["portfolio_properties"]["Row"];
export type ValuationRow = Database["public"]["Tables"]["portfolio_valuations"]["Row"];

function monthsBetween(from: Date, to: Date) {
  return Math.max(0, (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()));
}

/** Value at a date: latest valuation snapshot on/before date, else current_value (if date≥today), else purchase price. */
function valueAt(p: PortfolioRow, vals: ValuationRow[], at: Date): number {
  const own = vals
    .filter((v) => v.portfolio_property_id === p.id && new Date(v.valued_on) <= at)
    .sort((a, b) => a.valued_on.localeCompare(b.valued_on));
  if (own.length) return own[own.length - 1]!.value;
  return p.purchase_price;
}

export function propertyMetrics(p: PortfolioRow, vals: ValuationRow[], now = new Date()) {
  const latestVal = vals.filter((v) => v.portfolio_property_id === p.id).sort((a, b) => b.valued_on.localeCompare(a.valued_on))[0];
  const value = latestVal?.value ?? p.current_value ?? p.purchase_price;
  const paid = monthsBetween(new Date(p.purchase_date), now);
  const debt = calculateDebtBalance(p.mortgage_principal, p.interest_rate_bps, p.term_months, paid);
  const mortgage = calculateMortgagePayment(p.mortgage_principal, p.interest_rate_bps, p.term_months);
  const cashFlow = calculateCashFlow(p.monthly_rent, p.vacancy_bps, p.monthly_expenses, mortgage);
  return {
    value,
    debt,
    equity: value - debt,
    rent: p.monthly_rent,
    mortgage,
    cashFlow,
    yieldBps: calculateGrossYield(p.monthly_rent, p.purchase_price),
    appreciation: value - p.purchase_price,
  };
}

export function portfolioTotals(rows: PortfolioRow[], vals: ValuationRow[]) {
  const ms = rows.map((r) => propertyMetrics(r, vals));
  const sum = (k: keyof (typeof ms)[number]) => ms.reduce((a, m) => a + (m[k] as number), 0);
  const purchase = rows.reduce((a, r) => a + r.purchase_price, 0);
  const rent = sum("rent");
  return {
    value: sum("value"),
    debt: sum("debt"),
    equity: sum("equity"),
    rent,
    cashFlow: sum("cashFlow"),
    appreciation: sum("appreciation"),
    yieldBps: purchase > 0 ? calculateGrossYield(rent, purchase) : null,
    count: rows.length,
  };
}

export const RANGES = { "1M": 1, "3M": 3, "6M": 6, "1R": 12, "3R": 36, "5R": 60, ALL: 0 } as const;
export type RangeKey = keyof typeof RANGES;

/** Monthly time series from purchase dates + valuation snapshots + amortization. */
export function portfolioSeries(rows: PortfolioRow[], vals: ValuationRow[], range: RangeKey) {
  if (!rows.length) return [];
  const now = new Date();
  const earliest = rows.reduce((d, r) => (new Date(r.purchase_date) < d ? new Date(r.purchase_date) : d), now);
  const months = RANGES[range] || Math.max(1, monthsBetween(earliest, now));
  const out = [];
  for (let i = months; i >= 0; i--) {
    const at = new Date(now.getFullYear(), now.getMonth() - i, 1);
    let value = 0, debt = 0, rent = 0, cashFlow = 0;
    for (const p of rows) {
      if (new Date(p.purchase_date) > at) continue;
      const v = i === 0 ? propertyMetrics(p, vals).value : valueAt(p, vals, at);
      const paid = monthsBetween(new Date(p.purchase_date), at);
      const d = calculateDebtBalance(p.mortgage_principal, p.interest_rate_bps, p.term_months, paid);
      const m = calculateMortgagePayment(p.mortgage_principal, p.interest_rate_bps, p.term_months);
      value += v; debt += d; rent += p.monthly_rent;
      cashFlow += calculateCashFlow(p.monthly_rent, p.vacancy_bps, p.monthly_expenses, m);
    }
    out.push({ label: at.toLocaleDateString("cs-CZ", { month: "short", year: "2-digit" }), value, debt, equity: value - debt, rent, cashFlow });
  }
  return out;
}
