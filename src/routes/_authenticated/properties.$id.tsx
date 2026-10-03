import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Star, Plus } from "lucide-react";
import { addToWatchlist, listingsQuery, uid, watchlistQuery } from "@/lib/queries";
import { calculateMortgagePayment, calculateTotalReturn } from "@/lib/calculations";
import { defaultInvestmentInput, priorityBreakdown } from "@/lib/deals";
import { formatBps, formatCZK, formatNumber, formatRelative } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/head";
import { AvailabilityBadge, Delta, FreshnessBadge, Kpi, PriorityBadge, Row, SampleBadge, Section } from "@/components/app/shared";
import { InvestmentCalculator } from "@/components/app/InvestmentCalculator";
import { AiRunner } from "@/components/app/AiPanel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/properties/$id")({
  head: () => pageHead("Detail nemovitosti", "Investiční analýza nemovitosti: cena, odhad, výnos, cash-flow, scénáře a rizika."),
  loader: async ({ context, params }) => {
    const [all] = await Promise.all([context.queryClient.ensureQueryData(listingsQuery), context.queryClient.ensureQueryData(watchlistQuery)]);
    if (!all.find((e) => e.listing.id === params.id)) throw notFound();
  },
  notFoundComponent: () => <div className="p-8 text-center text-muted-foreground">Nemovitost nenalezena. <Link to="/properties" className="text-primary">Zpět</Link></div>,
  errorComponent: () => <div className="p-8 text-center text-muted-foreground">Detail se nepodařilo načíst.</div>,
  component: Detail,
});

const DD = [
  "Výpis z katastru nemovitostí (vlastník, věcná břemena, zástavy)",
  "Stanovy a hospodaření SVJ / družstva, fond oprav, plánované investice",
  "Energetický štítek (PENB) a stav rozvodů",
  "Nájemní smlouva a historie plateb (pokud je pronajato)",
  "Územní plán a plánovaná výstavba v okolí",
  "Ověření plochy dle prohlášení vlastníka",
  "Nezávislý odhad banky pro hypotéku",
];

function Detail() {
  const { id } = Route.useParams();
  const { data: all } = useSuspenseQuery(listingsQuery);
  const { data: wl } = useSuspenseQuery(watchlistQuery);
  const qc = useQueryClient();
  const e = all.find((x) => x.listing.id === id)!;
  const l = e.listing;
  const inWl = wl.some((w) => w.listing_id === id);
  const [pfOpen, setPfOpen] = useState(false);

  const comps = all.filter((x) => x.city === e.city && x.listing.id !== id).slice(0, 5);
  const base = l.price && e.rent ? defaultInvestmentInput(l.price, e.rent) : null;
  const calc = base ? calculateTotalReturn(base) : null;
  const scenarios = base
    ? ([
        ["Conservative", { ...base, monthlyRent: Math.round(base.monthlyRent * 0.9), vacancyBps: 1000, interestRateBps: base.interestRateBps + 100, appreciationBps: 100, rentGrowthBps: 100 }],
        ["Base", base],
        ["Optimistic", { ...base, monthlyRent: Math.round(base.monthlyRent * 1.05), vacancyBps: 300, appreciationBps: 450, rentGrowthBps: 350 }],
      ] as const).map(([n, i]) => [n, calculateTotalReturn(i)] as const)
    : [];
  const prices = e.priceHistory.filter((h) => h.price != null);

  const saveWl = async () => {
    try {
      await addToWatchlist(id);
      await qc.invalidateQueries({ queryKey: ["watchlist"] });
      toast.success("Uloženo do Watchlistu");
    } catch {
      toast.error("Uložení se nepovedlo");
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-card p-4">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {e.isSample && <SampleBadge />}
          <span>{l.source_domain}</span>·<span>ověřeno {formatRelative(l.last_verified_at)}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold sm:text-2xl">{l.title}</h1>
            <p className="text-sm text-muted-foreground">{[l.address, e.city].filter(Boolean).join(", ")}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="num text-2xl font-semibold">{formatCZK(l.price)}</div>
              <div className="num text-xs text-muted-foreground">{formatNumber(Number(l.area_m2))} m² · {formatCZK(e.pricePerM2)}/m²</div>
            </div>
            <PriorityBadge value={e.priority} size="lg" />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Kpi label="Hrubý výnos" value={formatBps(e.grossYieldBps)} sub="odhad" />
          <Kpi label="Cash-flow / měs." value={formatCZK(e.monthlyCashFlow)} tone={(e.monthlyCashFlow ?? 0) >= 0 ? "pos" : "neg"} sub="80% LTV" />
          <div className="rounded-md border bg-card p-3"><div className="text-[11px] uppercase tracking-wider text-muted-foreground">Freshness</div><div className="mt-1.5"><FreshnessBadge status={l.freshness_status} /></div></div>
          <div className="rounded-md border bg-card p-3"><div className="text-[11px] uppercase tracking-wider text-muted-foreground">Dostupnost</div><div className="mt-1.5"><AvailabilityBadge status={l.availability_status} /></div></div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm"><a href={l.source_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-1.5 h-4 w-4" />Otevřít původní inzerát</a></Button>
          <Button size="sm" variant={inWl ? "secondary" : "outline"} onClick={saveWl} disabled={inWl}><Star className="mr-1.5 h-4 w-4" />{inWl ? "Ve Watchlistu" : "Uložit do Watchlistu"}</Button>
          <Button size="sm" variant="outline" onClick={() => setPfOpen(true)}><Plus className="mr-1.5 h-4 w-4" />Přidat do portfolia</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Deal Priority – rozpad">
          {priorityBreakdown(e).map((b) => (
            <div key={b.label} className="mb-2">
              <div className="flex justify-between text-xs"><span>{b.label}</span><span className="num">{b.points}/{b.max}</span></div>
              <Progress value={(b.points / b.max) * 100} className="mt-1 h-1.5" />
            </div>
          ))}
          <ul className="mt-3 space-y-1 text-xs">
            {e.reasons.map((r, i) => <li key={i} className={r.positive ? "text-positive" : "text-muted-foreground"}>{r.positive ? "+ " : "− "}{r.text}</li>)}
          </ul>
        </Section>
        <Section title="Základní údaje">
          <Row k="Typ" v={l.property_type ?? "—"} />
          <Row k="Dispozice" v={l.rooms ?? "—"} />
          <Row k="Plocha" v={l.area_m2 ? `${formatNumber(Number(l.area_m2))} m²` : "—"} />
          <Row k="Stav" v={e.property?.condition ?? "Neuvedeno"} />
          <Row k="Budova" v={e.property?.building_type ?? "Neuvedeno"} />
          <Row k="Podlaží" v={e.property?.floor ?? "Neuvedeno"} />
          <Row k="PENB" v={e.property?.energy_class ?? "Neuvedeno"} />
          <Row k="První výskyt" v={new Date(l.first_seen_at).toLocaleDateString("cs-CZ")} />
        </Section>
        <Section title="Cena a historie ceny">
          {prices.map((h, i) => (
            <div key={h.at} className="flex justify-between border-b border-border/50 py-1.5 text-sm last:border-0">
              <span className="text-muted-foreground">{new Date(h.at).toLocaleDateString("cs-CZ")}</span>
              <span className="num">{formatCZK(h.price)} {i > 0 && <Delta value={h.price! - prices[i - 1]!.price!} />}</span>
            </div>
          ))}
          {prices.length <= 1 && <p className="mt-2 text-xs text-muted-foreground">Zatím jediné pozorování ceny – změny se zobrazí po dalším ověření.</p>}
        </Section>
        <Section title="Odhad hodnoty" right={e.estimate?.isSample ? <SampleBadge /> : null}>
          {e.estimate ? (
            <>
              <div className="num text-xl font-semibold">{formatCZK(e.estimate.estimatedValue)}</div>
              <div className="num text-xs text-muted-foreground">{formatCZK(e.estimate.low)} – {formatCZK(e.estimate.high)}</div>
              <Row k="Rozdíl vůči ceně" v={e.diffBps == null ? "—" : <span className={e.diffBps < 0 ? "text-positive" : "text-negative"}>{e.diffBps > 0 ? "+" : ""}{formatBps(e.diffBps, 1)}</span>} />
              <Row k="Metoda" v="Nabídkové ceny v lokalitě" />
              <Row k="Jistota" v={e.estimate.confidence === "medium" ? "střední" : "nízká"} />
              <p className="mt-2 text-xs text-muted-foreground">Odhad vychází z nabídkových (ne realizovaných) cen – ESTIMATE.</p>
            </>
          ) : <p className="text-sm text-muted-foreground">Nedostatek dat pro odhad.</p>}
        </Section>
        <Section title="Odhad nájmu">
          <div className="num text-xl font-semibold">{formatCZK(e.rent)}<span className="text-sm text-muted-foreground"> / měs.</span></div>
          <p className="mt-2 text-xs text-muted-foreground">Průměrný nájem za m² v lokalitě × plocha. Nízká jistota – ověřte u srovnatelných pronájmů.</p>
        </Section>
        <Section title="Financování">
          {calc ? (
            <>
              <Row k="Úvěr (80 % LTV)" v={formatCZK(calc.loan)} />
              <Row k="Vlastní zdroje" v={formatCZK(calc.cashInvested)} />
              <Row k="Splátka (4,89 %, 30 let)" v={formatCZK(calc.monthlyMortgage)} />
              <Row k="Splátka při 70 % LTV" v={formatCZK(calculateMortgagePayment(Math.round(l.price! * 0.7), 489, 360))} />
            </>
          ) : <p className="text-sm text-muted-foreground">Chybí cena nebo nájem.</p>}
        </Section>
      </div>

      {scenarios.length > 0 && (
        <Section title="Scénáře · cash-flow · výnos">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground"><tr><th className="py-1 font-medium">Scénář</th><th className="text-right font-medium">Cash-flow/měs.</th><th className="text-right font-medium">Net yield</th><th className="text-right font-medium">Cash-on-cash</th><th className="text-right font-medium">IRR</th><th className="text-right font-medium">Total return (10 let)</th></tr></thead>
              <tbody>
                {scenarios.map(([n, r]) => (
                  <tr key={n} className="border-t border-border/50">
                    <td className="py-1.5">{n}</td>
                    <td className={`num text-right ${r.monthlyCashFlow < 0 ? "text-negative" : "text-positive"}`}>{formatCZK(r.monthlyCashFlow)}</td>
                    <td className="num text-right">{formatBps(r.netYieldBps)}</td>
                    <td className="num text-right">{formatBps(r.cashOnCashBps)}</td>
                    <td className="num text-right">{r.irrBps == null ? "—" : formatBps(r.irrBps)}</td>
                    <td className="num text-right">{formatCZK(r.totalReturn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Conservative: nájem −10 %, neobsazenost 10 %, úrok +1 p.b., růst ceny 1 %. Optimistic: nájem +5 %, neobsazenost 3 %, růst ceny 4,5 %. ASSUMPTION.</p>
        </Section>
      )}

      {base && (
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Investiční kalkulace</h2>
          <InvestmentCalculator initial={base} compact />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Srovnatelné nabídky">
          {comps.length === 0 ? <p className="text-sm text-muted-foreground">Žádné další nabídky v lokalitě.</p> : comps.map((c) => (
            <Link key={c.listing.id} to="/properties/$id" params={{ id: c.listing.id }} className="flex justify-between border-b border-border/50 py-1.5 text-sm last:border-0 hover:text-primary">
              <span className="truncate">{c.listing.title}</span>
              <span className="num shrink-0">{formatCZK(c.pricePerM2)}/m²</span>
            </Link>
          ))}
        </Section>
        <Section title="Rizika">
          <ul className="space-y-1 text-sm">
            {e.reasons.filter((r) => !r.positive).map((r, i) => <li key={i}>− {r.text}</li>)}
            {l.freshness_status !== "FRESH" && <li>− Nabídka nemusí být aktuální, ověřte u zdroje.</li>}
          </ul>
        </Section>
        <Section title="Due diligence">
          <ul className="list-disc space-y-1 pl-5 text-sm">{DD.map((d) => <li key={d}>{d}</li>)}</ul>
        </Section>
        <Section title="AI analýza">
          <AiRunner kind="property" listingId={id} />
        </Section>
      </div>

      <AddToPortfolio open={pfOpen} onOpenChange={setPfOpen} e={e} />
    </div>
  );
}

function AddToPortfolio({ open, onOpenChange, e }: { open: boolean; onOpenChange: (o: boolean) => void; e: ReturnType<typeof useDetailType> }) {
  const qc = useQueryClient();
  const price = e.listing.price ?? 0;
  const [v, setV] = useState({ name: e.listing.title ?? "", price: String(price), mortgage: String(Math.round(price * 0.8)), rate: "4.89", years: "30", rent: String(e.rent ?? 0), expenses: String(Math.round((e.rent ?? 0) * 0.15)), date: new Date().toISOString().slice(0, 10) });
  const save = async () => {
    try {
      const user_id = await uid();
      const { error } = await supabase.from("portfolio_properties").insert({
        user_id, property_id: e.listing.property_id, name: v.name.slice(0, 200) || "Nemovitost", city: e.city, area_m2: e.listing.area_m2,
        purchase_price: Math.round(Number(v.price)), purchase_date: v.date, current_value: Math.round(Number(v.price)),
        mortgage_principal: Math.round(Number(v.mortgage)), interest_rate_bps: Math.round(Number(v.rate.replace(",", ".")) * 100),
        term_months: Math.round(Number(v.years) * 12), monthly_rent: Math.round(Number(v.rent)), monthly_expenses: Math.round(Number(v.expenses)), vacancy_bps: 500,
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["portfolio"] });
      toast.success("Přidáno do portfolia");
      onOpenChange(false);
    } catch {
      toast.error("Přidání se nepovedlo – zkontrolujte hodnoty.");
    }
  };
  const fields: [keyof typeof v, string][] = [["name", "Název"], ["price", "Kupní cena (Kč)"], ["date", "Datum koupě"], ["mortgage", "Hypotéka (Kč)"], ["rate", "Úrok (%)"], ["years", "Doba (let)"], ["rent", "Nájem / měs."], ["expenses", "Náklady / měs."]];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Přidat do portfolia</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {fields.map(([k, label]) => (
            <div key={k} className={k === "name" ? "col-span-2 space-y-1" : "space-y-1"}>
              <Label htmlFor={`pf-${k}`} className="text-xs">{label}</Label>
              <Input id={`pf-${k}`} type={k === "date" ? "date" : "text"} value={v[k]} onChange={(ev) => setV({ ...v, [k]: ev.target.value })} />
            </div>
          ))}
        </div>
        <DialogFooter><Button onClick={save}>Uložit</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
type DetailE = Awaited<ReturnType<NonNullable<typeof listingsQuery.queryFn>>>[number];
function useDetailType(): DetailE { return null as never; }
