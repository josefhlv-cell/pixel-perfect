import { useMemo, useState } from "react";
import { calculateTotalReturn, type InvestmentInput } from "@/lib/calculations";
import { formatBps, formatCZK } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Kpi, Row } from "./shared";
import { ValueChart } from "./Charts";

type Field = { key: keyof InvestmentInput | "equity" | "fixYears"; label: string; unit: "Kč" | "%" | "let" | "měs." };
const FIELDS: Field[] = [
  { key: "purchasePrice", label: "Kupní cena", unit: "Kč" },
  { key: "equity", label: "Vlastní kapitál", unit: "Kč" },
  { key: "ltvBps", label: "LTV", unit: "%" },
  { key: "interestRateBps", label: "Úrok", unit: "%" },
  { key: "termMonths", label: "Délka hypotéky", unit: "let" },
  { key: "fixYears", label: "Fixace", unit: "let" },
  { key: "monthlyRent", label: "Nájem / měs.", unit: "Kč" },
  { key: "vacancyBps", label: "Neobsazenost", unit: "%" },
  { key: "monthlyExpenses", label: "Provozní náklady / měs.", unit: "Kč" },
  { key: "renovation", label: "Rekonstrukce", unit: "Kč" },
  { key: "rentGrowthBps", label: "Růst nájemného / rok", unit: "%" },
  { key: "appreciationBps", label: "Růst ceny / rok", unit: "%" },
  { key: "holdingYears", label: "Délka držení", unit: "let" },
];

/** UI only: every number comes from calculateTotalReturn (existing engine). */
export function InvestmentCalculator({ initial, compact }: { initial: InvestmentInput; compact?: boolean }) {
  const [inp, setInp] = useState<InvestmentInput>(initial);
  const [fixYears, setFix] = useState(5);
  const r = useMemo(() => calculateTotalReturn(inp), [inp]);

  const display = (f: Field): number => {
    if (f.key === "equity") return inp.purchasePrice - Math.round((inp.purchasePrice * inp.ltvBps) / 10_000);
    if (f.key === "fixYears") return fixYears;
    const v = inp[f.key] as number;
    if (f.unit === "%") return v / 100;
    if (f.key === "termMonths") return v / 12;
    return v;
  };
  const change = (f: Field, raw: string) => {
    const n = Number(raw.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) return;
    if (f.key === "fixYears") return setFix(n);
    if (f.key === "equity") {
      const eq = Math.min(n, inp.purchasePrice);
      return setInp({ ...inp, ltvBps: inp.purchasePrice > 0 ? Math.round(((inp.purchasePrice - eq) / inp.purchasePrice) * 10_000) : 0 });
    }
    if (f.unit === "%") return setInp({ ...inp, [f.key]: Math.round(n * 100) });
    if (f.key === "termMonths") return setInp({ ...inp, termMonths: Math.max(12, Math.round(n * 12)) });
    if (f.key === "holdingYears") return setInp({ ...inp, holdingYears: Math.max(1, Math.round(n)) });
    setInp({ ...inp, [f.key]: Math.round(n) });
  };

  const paydown = r.loan - r.exitDebt;
  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="grid grid-cols-2 gap-3 self-start rounded-md border bg-card p-4 lg:grid-cols-1">
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-1">
            <Label htmlFor={`calc-${f.key}`} className="text-xs text-muted-foreground">{f.label} <span className="opacity-60">({f.unit})</span></Label>
            <Input id={`calc-${f.key}`} inputMode="decimal" className="num h-9" value={String(display(f))} onChange={(e) => change(f, e.target.value)} />
          </div>
        ))}
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Kpi label="Měsíční splátka" value={formatCZK(r.monthlyMortgage)} />
          <Kpi label="Cash-flow / měs." value={formatCZK(r.monthlyCashFlow)} tone={r.monthlyCashFlow >= 0 ? "pos" : "neg"} />
          <Kpi label="Gross yield" value={formatBps(r.grossYieldBps)} />
          <Kpi label="Net yield" value={formatBps(r.netYieldBps)} />
          <Kpi label="Cash-on-cash" value={formatBps(r.cashOnCashBps)} tone={r.cashOnCashBps >= 0 ? "pos" : "neg"} />
          <Kpi label="ROI" value={formatBps(r.roiBps)} sub={`za ${inp.holdingYears} let`} />
          <Kpi label="IRR" value={r.irrBps == null ? "—" : formatBps(r.irrBps)} />
          <Kpi label="LTV" value={formatBps(r.ltvBps, 0)} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-md border bg-card p-4">
            <Row k="Úvěr" v={formatCZK(r.loan)} />
            <Row k="Vlastní zdroje celkem" v={formatCZK(r.cashInvested)} />
            <Row k="Celkové pořizovací náklady" v={formatCZK(r.totalCost)} />
            <Row k={`Budoucí hodnota (rok ${inp.holdingYears})`} v={formatCZK(r.exitValue)} />
            <Row k="Zbývající dluh" v={formatCZK(r.exitDebt)} />
            <Row k="Splacená jistina" v={formatCZK(paydown)} />
            <Row k="Equity při prodeji" v={formatCZK(r.exitEquity)} />
            <Row k="Total return" v={<span className={r.totalReturn >= 0 ? "text-positive" : "text-negative"}>{formatCZK(r.totalReturn)}</span>} />
            <p className="mt-2 text-xs text-muted-foreground">Refixace úroku po {fixYears} letech – výpočet předpokládá stejnou sazbu po celou dobu.</p>
          </div>
          {!compact && (
            <div className="rounded-md border bg-card p-4">
              <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Hodnota · dluh · equity</div>
              <ValueChart data={r.yearly.map((y) => ({ label: `R${y.year}`, value: y.value, debt: y.debt, equity: y.equity }))} keys={["value", "equity", "debt"]} height={220} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
