import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Receipt, TrendingUp } from "lucide-react";
import { portfolioQuery, uid } from "@/lib/queries";
import { portfolioSeries, portfolioTotals, propertyMetrics, RANGES, type PortfolioRow, type RangeKey } from "@/lib/portfolio";
import { supabase } from "@/integrations/supabase/client";
import { formatBps, formatCZK } from "@/lib/format";
import { pageHead } from "@/lib/head";
import { t } from "@/lib/i18n";
import { Empty, Kpi, PageHeader, Section } from "@/components/app/shared";
import { ValueChart, SERIES } from "@/components/app/Charts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/portfolio")({
  head: () => pageHead("Portfolio", "Vaše nemovitosti: hodnota, equity, dluh, nájem a cash-flow."),
  loader: ({ context }) => context.queryClient.ensureQueryData(portfolioQuery),
  component: Portfolio,
});

const n = (s: string) => Math.round(Number(String(s).replace(/\s/g, "").replace(",", ".")) || 0);

function Portfolio() {
  const { data } = useSuspenseQuery(portfolioQuery);
  const qc = useQueryClient();
  const [range, setRange] = useState<RangeKey>("ALL");
  const [metric, setMetric] = useState<"value" | "equity" | "debt" | "rent" | "cashFlow">("value");
  const [edit, setEdit] = useState<PortfolioRow | "new" | null>(null);
  const [del, setDel] = useState<PortfolioRow | null>(null);
  const [tx, setTx] = useState<PortfolioRow | null>(null);
  const [val, setVal] = useState<PortfolioRow | null>(null);
  const totals = portfolioTotals(data.properties, data.valuations);
  const series = useMemo(() => portfolioSeries(data.properties, data.valuations, range), [data, range]);
  const refresh = () => qc.invalidateQueries({ queryKey: ["portfolio"] });

  const remove = async () => {
    if (!del) return;
    await supabase.from("portfolio_transactions").delete().eq("portfolio_property_id", del.id);
    const { error } = await supabase.from("portfolio_properties").delete().eq("id", del.id);
    if (error) toast.error("Odstranění se nepovedlo (historie ocenění je neměnná a brání smazání).");
    else toast.success("Odstraněno");
    setDel(null);
    refresh();
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Portfolio" actions={<Button size="sm" onClick={() => setEdit("new")}><Plus className="mr-1.5 h-4 w-4" />Přidat nemovitost</Button>} />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
        <Kpi label="Hodnota" value={formatCZK(totals.value)} />
        <Kpi label="Equity" value={formatCZK(totals.equity)} />
        <Kpi label="Dluh" value={formatCZK(totals.debt)} />
        <Kpi label="Nájem / měs." value={formatCZK(totals.rent)} />
        <Kpi label="Cash-flow / měs." value={formatCZK(totals.cashFlow)} tone={totals.cashFlow >= 0 ? "pos" : "neg"} />
        <Kpi label="Výnos" value={totals.yieldBps == null ? "—" : formatBps(totals.yieldBps)} />
        <Kpi label="Zhodnocení" value={formatCZK(totals.appreciation)} tone={totals.appreciation >= 0 ? "pos" : "neg"} />
      </div>
      {data.properties.length === 0 ? <Empty>{t("empty.portfolio")} <Link to="/deals" className="text-primary hover:underline">Deal Hunter</Link></Empty> : (
        <>
          <Section title="Vývoj" right={<div className="flex gap-0.5">{(Object.keys(RANGES) as RangeKey[]).map((r) => <button key={r} onClick={() => setRange(r)} className={cn("num rounded px-2 py-0.5 text-[11px]", r === range ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{r}</button>)}</div>}>
            <div className="mb-3 flex flex-wrap gap-1">{(["value", "equity", "debt", "rent", "cashFlow"] as const).map((m) => <Button key={m} size="sm" variant={m === metric ? "secondary" : "ghost"} className="h-7 text-xs" onClick={() => setMetric(m)}>{SERIES[m]!.label}</Button>)}</div>
            <ValueChart data={series} keys={[metric]} />
          </Section>
          <div className="overflow-x-auto rounded-md border bg-card">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>{["Nemovitost", "Hodnota", "Dluh", "Equity", "Nájem", "Cash-flow", "Výnos", ""].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {data.properties.map((p) => {
                  const m = propertyMetrics(p, data.valuations);
                  return (
                    <tr key={p.id} className="border-b border-border/50">
                      <td className="px-3 py-2"><div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{p.city} · koupeno {new Date(p.purchase_date).toLocaleDateString("cs-CZ")}</div></td>
                      <td className="num px-3 py-2">{formatCZK(m.value)}</td>
                      <td className="num px-3 py-2">{formatCZK(m.debt)}</td>
                      <td className="num px-3 py-2">{formatCZK(m.equity)}</td>
                      <td className="num px-3 py-2">{formatCZK(m.rent)}</td>
                      <td className={cn("num px-3 py-2", m.cashFlow < 0 ? "text-negative" : "text-positive")}>{formatCZK(m.cashFlow)}</td>
                      <td className="num px-3 py-2">{formatBps(m.yieldBps)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        <Button size="icon" variant="ghost" aria-label="Transakce" onClick={() => setTx(p)}><Receipt className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" aria-label="Ocenění" onClick={() => setVal(p)}><TrendingUp className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" aria-label="Upravit" onClick={() => setEdit(p)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" aria-label="Odstranit" onClick={() => setDel(p)}><Trash2 className="h-4 w-4" /></Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Section title="Poslední transakce">
            {data.transactions.length === 0 ? <p className="text-sm text-muted-foreground">Žádné transakce.</p> : data.transactions.slice(0, 10).map((x) => (
              <div key={x.id} className="flex justify-between border-b border-border/50 py-1.5 text-sm last:border-0">
                <span>{new Date(x.occurred_on).toLocaleDateString("cs-CZ")} · {x.kind}{x.note ? ` · ${x.note}` : ""}</span>
                <span className={cn("num", x.amount < 0 ? "text-negative" : "text-positive")}>{formatCZK(x.amount)}</span>
              </div>
            ))}
          </Section>
        </>
      )}

      {edit && <EditDialog row={edit === "new" ? null : edit} onClose={() => { setEdit(null); refresh(); }} />}
      {tx && <TxDialog row={tx} onClose={() => { setTx(null); refresh(); }} />}
      {val && <ValDialog row={val} onClose={() => { setVal(null); refresh(); }} />}
      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Odstranit {del?.name}?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Zrušit</AlertDialogCancel><AlertDialogAction onClick={remove}>Odstranit</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Fields<T extends Record<string, string>>({ v, set, defs }: { v: T; set: (v: T) => void; defs: [keyof T & string, string, string?][] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {defs.map(([k, label, type]) => (
        <div key={k} className={k === "name" || k === "note" ? "col-span-2 space-y-1" : "space-y-1"}>
          <Label htmlFor={`f-${k}`} className="text-xs">{label}</Label>
          <Input id={`f-${k}`} type={type ?? "text"} value={v[k]} onChange={(e) => set({ ...v, [k]: e.target.value })} />
        </div>
      ))}
    </div>
  );
}

function EditDialog({ row, onClose }: { row: PortfolioRow | null; onClose: () => void }) {
  const [v, setV] = useState({
    name: row?.name ?? "", city: row?.city ?? "", area: String(row?.area_m2 ?? ""), price: String(row?.purchase_price ?? ""), date: row?.purchase_date ?? new Date().toISOString().slice(0, 10),
    value: String(row?.current_value ?? ""), mortgage: String(row?.mortgage_principal ?? 0), rate: String((row?.interest_rate_bps ?? 489) / 100), years: String((row?.term_months ?? 360) / 12),
    rent: String(row?.monthly_rent ?? 0), expenses: String(row?.monthly_expenses ?? 0), vacancy: String((row?.vacancy_bps ?? 500) / 100),
  });
  const save = async () => {
    if (!v.name.trim() || n(v.price) <= 0) return toast.error("Vyplňte název a kupní cenu.");
    const payload = {
      name: v.name.trim().slice(0, 200), city: v.city.trim() || null, area_m2: v.area ? Number(v.area.replace(",", ".")) : null, purchase_price: n(v.price), purchase_date: v.date,
      current_value: v.value ? n(v.value) : null, mortgage_principal: n(v.mortgage), interest_rate_bps: Math.round(Number(v.rate.replace(",", ".")) * 100),
      term_months: Math.max(12, Math.round(Number(v.years) * 12)), monthly_rent: n(v.rent), monthly_expenses: n(v.expenses), vacancy_bps: Math.round(Number(v.vacancy.replace(",", ".")) * 100),
    };
    const { error } = row ? await supabase.from("portfolio_properties").update(payload).eq("id", row.id) : await supabase.from("portfolio_properties").insert({ ...payload, user_id: await uid() });
    if (error) return toast.error("Uložení se nepovedlo.");
    toast.success("Uloženo");
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{row ? "Upravit nemovitost" : "Přidat nemovitost"}</DialogTitle></DialogHeader>
        <Fields v={v} set={setV} defs={[["name", "Název"], ["city", "Město"], ["area", "Plocha m²"], ["price", "Kupní cena"], ["date", "Datum koupě", "date"], ["value", "Aktuální hodnota"], ["mortgage", "Hypotéka (jistina)"], ["rate", "Úrok %"], ["years", "Doba (let)"], ["rent", "Nájem / měs."], ["expenses", "Náklady / měs."], ["vacancy", "Neobsazenost %"]]} />
        <DialogFooter><Button onClick={save}>Uložit</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TxDialog({ row, onClose }: { row: PortfolioRow; onClose: () => void }) {
  const [kind, setKind] = useState("rent");
  const [v, setV] = useState({ amount: "", date: new Date().toISOString().slice(0, 10), note: "" });
  const save = async () => {
    const sign = ["rent", "income", "sale"].includes(kind) ? 1 : -1;
    const { error } = await supabase.from("portfolio_transactions").insert({ user_id: await uid(), portfolio_property_id: row.id, kind, amount: sign * Math.abs(n(v.amount)), occurred_on: v.date, note: v.note.slice(0, 300) || null });
    if (error) return toast.error("Uložení se nepovedlo.");
    toast.success("Transakce přidána");
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Transakce · {row.name}</DialogTitle></DialogHeader>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {[["rent", "Nájem"], ["income", "Jiný příjem"], ["expense", "Náklad"], ["repair", "Oprava"], ["tax", "Daň"], ["sale", "Prodej"]].map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Fields v={v} set={setV} defs={[["amount", "Částka (Kč)"], ["date", "Datum", "date"], ["note", "Poznámka"]]} />
        <DialogFooter><Button onClick={save}>Přidat</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ValDialog({ row, onClose }: { row: PortfolioRow; onClose: () => void }) {
  const [v, setV] = useState({ value: String(row.current_value ?? row.purchase_price), date: new Date().toISOString().slice(0, 10) });
  const save = async () => {
    const { error } = await supabase.from("portfolio_valuations").insert({ user_id: await uid(), portfolio_property_id: row.id, value: n(v.value), valued_on: v.date, source: "manual" });
    if (error) return toast.error("Uložení se nepovedlo.");
    toast.success("Ocenění uloženo");
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Valuation snapshot · {row.name}</DialogTitle></DialogHeader>
        <Fields v={v} set={setV} defs={[["value", "Hodnota (Kč)"], ["date", "Ke dni", "date"]]} />
        <p className="text-xs text-muted-foreground">Snapshoty ocenění jsou neměnné (append-only historie).</p>
        <DialogFooter><Button onClick={save}>Uložit</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
