import { useMemo, useState } from "react";
import { calculateStressScenario, calculateTotalReturn, DEFAULT_ASSUMPTIONS, type InvestmentInput } from "@/lib/calculations";
import { formatBps, formatCZK } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Kpi, Row } from "./shared";
import { ValueChart } from "./Charts";
import { cn } from "@/lib/utils";

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

const MORTGAGE_PRESETS = [
  { label: "LTV 70 % · 4,5 %", ltvBps: 7000, interestRateBps: 450, termMonths: 360 },
  { label: "LTV 80 % · 4,89 %", ltvBps: 8000, interestRateBps: 489, termMonths: 360 },
  { label: "LTV 90 % · 5,3 %", ltvBps: 9000, interestRateBps: 530, termMonths: 360 },
] as const;

type ScenarioKey = "base" | "optimistic" | "pessimistic";

const SCENARIOS: Record<ScenarioKey, { label: string; stress?: Parameters<typeof calculateStressScenario>[1] }> = {
  base: { label: "Realistický" },
  optimistic: {
    label: "Optimistický",
    stress: { rateShockBps: -50, rentShockBps: -500, vacancyShockBps: -200, valueShockBps: -100 },
  },
  pessimistic: {
    label: "Pesimistický",
    stress: { rateShockBps: 150, rentShockBps: 1000, vacancyShockBps: 500, valueShockBps: 200 },
  },
};

/** UI only: every number comes from calculateTotalReturn (existing engine). */
export function InvestmentCalculator({ initial, compact }: { initial: InvestmentInput; compact?: boolean }) {
  const [inp, setInp] = useState<InvestmentInput>(initial);
  const [fixYears, setFix] = useState(5);
  const [scenario, setScenario] = useState<ScenarioKey>("base");

  const r = useMemo(() => {
    const s = SCENARIOS[scenario];
    if (s.stress) return calculateStressScenario(inp, s.stress);
    return calculateTotalReturn(inp);
  }, [inp, scenario]);

  // Orientační daň z příjmu z nájmu (paušál 30 % výdajů, 15 % sazba) – není daňové poradenství
  const taxEstimate = useMemo(() => {
    const annualRent = inp.monthlyRent * 12;
    const vacancyLoss = Math.round(annualRent * (inp.vacancyBps / 10_000));
    const gross = annualRent - vacancyLoss;
    const flatExpenses = Math.round(gross * 0.3); // §7 paušál orientačně
    const taxBase = Math.max(0, gross - flatExpenses);
    const tax = Math.round(taxBase * 0.15);
    return { gross, taxBase, tax, monthlyAfterTaxCf: r.monthlyCashFlow - Math.round(tax / 12) };
  }, [inp, r.monthlyCashFlow]);

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
      <div className="space-y-3 self-start">
        <div className="flex flex-wrap gap-1">
          {MORTGAGE_PRESETS.map((p) => (
            <Button
              key={p.label}
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              onClick={() => setInp({ ...inp, ltvBps: p.ltvBps, interestRateBps: p.interestRateBps, termMonths: p.termMonths })}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <div className="flex gap-1">
          {(Object.keys(SCENARIOS) as ScenarioKey[]).map((k) => (
            <Button key={k} size="sm" variant={scenario === k ? "secondary" : "ghost"} className="h-7 text-xs" onClick={() => setScenario(k)}>
              {SCENARIOS[k].label}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 rounded-md border bg-card p-4 lg:grid-cols-1">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label htmlFor={`calc-${f.key}`} className="text-xs text-muted-foreground">{f.label} <span className="opacity-60">({f.unit})</span></Label>
              <Input id={`calc-${f.key}`} inputMode="decimal" className="num h-9" value={String(display(f))} onChange={(e) => change(f, e.target.value)} />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Kpi label="Měsíční splátka" value={formatCZK(r.monthlyMortgage)} />
          <Kpi label="NOI / měs." value={formatCZK(r.monthlyNOI)} tone={r.monthlyNOI >= 0 ? "pos" : "neg"} />
          <Kpi label="Cash-flow / měs." value={formatCZK(r.monthlyCashFlow)} tone={r.monthlyCashFlow >= 0 ? "pos" : "neg"} />
          <Kpi label="DSCR" value={r.debtServiceCoverageRatio == null ? "—" : r.debtServiceCoverageRatio.toLocaleString("cs-CZ", { maximumFractionDigits: 2 }) + "×"} sub="NOI / splátka" />
          <Kpi label="Nájem na nulu CF" value={r.breakEvenRent > 0 ? formatCZK(r.breakEvenRent) : "—"} sub="měsíčně, před daní" />
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
            <Row k="NOI / měsíc" v={formatCZK(r.monthlyNOI)} />
            <Row k="DSCR" v={r.debtServiceCoverageRatio == null ? "Bez úvěru" : r.debtServiceCoverageRatio.toLocaleString("cs-CZ", { maximumFractionDigits: 2 }) + "×"} />
            <Row k="Nájem na nulu CF" v={r.breakEvenRent > 0 ? formatCZK(r.breakEvenRent) : "Nedosažitelné při 100% neobsazenosti"} />
            <Row k="Vlastní zdroje celkem" v={formatCZK(r.cashInvested)} />
            <Row k="Celkové pořizovací náklady" v={formatCZK(r.totalCost)} />
            <Row k={`Budoucí hodnota (rok ${inp.holdingYears})`} v={formatCZK(r.exitValue)} />
            <Row k="Zbývající dluh" v={formatCZK(r.exitDebt)} />
            <Row k="Splacená jistina" v={formatCZK(paydown)} />
            <Row k="Equity při prodeji" v={formatCZK(r.exitEquity)} />
            <Row k="Total return" v={<span className={r.totalReturn >= 0 ? "text-positive" : "text-negative"}>{formatCZK(r.totalReturn)}</span>} />
            <div className="mt-3 border-t pt-3">
              <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Orientační daň z nájmu (paušál 30 %, 15 %)</div>
              <Row k="Základ daně / rok" v={formatCZK(taxEstimate.taxBase)} />
              <Row k="Daň / rok" v={formatCZK(taxEstimate.tax)} />
              <Row k="CF po dani / měs. (odhad)" v={formatCZK(taxEstimate.monthlyAfterTaxCf)} />
              <p className="mt-1 text-[11px] text-muted-foreground">Nejde o daňové poradenství. Skutečná daň závisí na režimu a odpočtech.</p>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Scénář: {SCENARIOS[scenario].label}. Refixace po {fixYears} letech – výpočet předpokládá stejnou sazbu. Výchozí LTV {DEFAULT_ASSUMPTIONS.ltvBps / 100} %.</p>
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
