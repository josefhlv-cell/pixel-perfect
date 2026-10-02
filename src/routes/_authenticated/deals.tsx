import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PlugZap } from "lucide-react";
import { listingsQuery, profileQuery } from "@/lib/queries";
import { calculateTotalReturn } from "@/lib/calculations";
import { defaultInvestmentInput } from "@/lib/deals";
import { isActive } from "@/lib/freshness";
import { pageHead } from "@/lib/head";
import { ListingCard } from "@/components/app/ListingCard";
import { Empty, PageHeader, SampleBadge } from "@/components/app/shared";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/deals")({
  head: () => pageHead("Deal Hunter", "Potenciální investiční dealy s transparentním Deal Priority."),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(listingsQuery), context.queryClient.ensureQueryData(profileQuery)]),
  component: DealHunter,
});

type Strategy = "cashflow" | "yield" | "discount" | "priority";

function DealHunter() {
  const { data } = useSuspenseQuery(listingsQuery);
  const { data: prof } = useSuspenseQuery(profileQuery);
  const inv = prof.investor;
  const [f, setF] = useState({
    location: inv?.locations?.[0] ?? "",
    radius: "",
    type: "all",
    rooms: "",
    maxPrice: inv?.max_price ? String(inv.max_price) : "",
    minYield: inv?.min_gross_yield_bps ? String(inv.min_gross_yield_bps / 100) : "",
    minDiscount: "",
    minCashFlow: "",
    maxLtv: inv?.ltv_bps ? String(inv.ltv_bps / 100) : "80",
    strategy: "priority" as Strategy,
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));

  const results = useMemo(() => {
    const ltvBps = Math.round((num(f.maxLtv) ?? 80) * 100);
    return data
      .filter((e) => isActive(e.listing.availability_status as never))
      .map((e) => ({
        e,
        cf: e.listing.price && e.rent ? calculateTotalReturn(defaultInvestmentInput(e.listing.price, e.rent, { ltvBps })).monthlyCashFlow : null,
      }))
      .filter(({ e, cf }) => {
        if (f.location && !(e.city ?? "").toLowerCase().includes(f.location.toLowerCase())) return false;
        if (f.type !== "all" && e.listing.property_type && e.listing.property_type !== f.type) return false;
        if (f.rooms && !(e.listing.rooms ?? "").includes(f.rooms)) return false;
        const mp = num(f.maxPrice); if (mp != null && (e.listing.price ?? Infinity) > mp) return false;
        const my = num(f.minYield); if (my != null && (e.grossYieldBps ?? -1) < my * 100) return false;
        const md = num(f.minDiscount); if (md != null && (e.diffBps == null || -e.diffBps < md * 100)) return false;
        const mc = num(f.minCashFlow); if (mc != null && (cf == null || cf < mc)) return false;
        return true;
      })
      .sort((a, b) => {
        if (f.strategy === "cashflow") return (b.cf ?? -1e12) - (a.cf ?? -1e12);
        if (f.strategy === "yield") return (b.e.grossYieldBps ?? -1) - (a.e.grossYieldBps ?? -1);
        if (f.strategy === "discount") return (a.e.diffBps ?? 1e9) - (b.e.diffBps ?? 1e9);
        return b.e.priority - a.e.priority;
      });
  }, [data, f]);

  return (
    <div className="space-y-5">
      <PageHeader title="Deal Hunter" sub="Nastavte kritéria. Každý výsledek ukazuje, proč se shoduje – i co mluví proti." />

      <div className="flex gap-3 rounded-md border border-warning/40 bg-warning/5 p-4">
        <PlugZap className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <div className="text-sm">
          <div className="font-medium">Datový zdroj není připojen.</div>
          <div className="text-muted-foreground">Deal Hunter je připravený na připojení veřejných webových zdrojů. Aktuálně používá pouze sample data.</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-md border bg-card p-4 md:grid-cols-5">
        <F label="Lokalita"><Input value={f.location} onChange={set("location")} placeholder="např. Brno" /></F>
        <F label="Radius (km)"><Input value={f.radius} onChange={set("radius")} inputMode="numeric" placeholder="vyžaduje živý zdroj" disabled /></F>
        <F label="Typ">
          <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Vše</SelectItem><SelectItem value="byt">Byt</SelectItem><SelectItem value="dum">Dům</SelectItem></SelectContent>
          </Select>
        </F>
        <F label="Dispozice"><Input value={f.rooms} onChange={set("rooms")} placeholder="2+kk" /></F>
        <F label="Max. cena (Kč)"><Input value={f.maxPrice} onChange={set("maxPrice")} inputMode="numeric" /></F>
        <F label="Min. výnos (%)"><Input value={f.minYield} onChange={set("minYield")} inputMode="decimal" /></F>
        <F label="Min. sleva vs. odhad (%)"><Input value={f.minDiscount} onChange={set("minDiscount")} inputMode="decimal" /></F>
        <F label="Min. cash-flow (Kč)"><Input value={f.minCashFlow} onChange={set("minCashFlow")} inputMode="numeric" /></F>
        <F label="Max. LTV (%)"><Input value={f.maxLtv} onChange={set("maxLtv")} inputMode="decimal" /></F>
        <F label="Strategie">
          <Select value={f.strategy} onValueChange={(v) => setF({ ...f, strategy: v as Strategy })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="priority">Deal Priority</SelectItem>
              <SelectItem value="cashflow">Cash-flow</SelectItem>
              <SelectItem value="yield">Výnos</SelectItem>
              <SelectItem value="discount">Sleva vůči odhadu</SelectItem>
            </SelectContent>
          </Select>
        </F>
      </div>

      <div className="flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Potential deals</h2>
        <span className="num text-xs text-muted-foreground">({results.length})</span>
        <SampleBadge />
      </div>
      {results.length === 0 ? <Empty>Kritériím neodpovídá žádná nabídka. Zkuste je uvolnit.</Empty> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {results.map(({ e }) => <ListingCard key={e.listing.id} e={e} showReasons />)}
        </div>
      )}
      <p className="text-xs text-muted-foreground">Deal Priority = sleva vůči odhadu (max 35) + hrubý výnos (30) + čerstvost (20) + ověřená dostupnost (10) + snížení ceny (5). Rozpad bodů najdete na detailu nemovitosti.</p>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}
