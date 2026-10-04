import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ExternalLink, Loader2, Search } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { runWebAgent } from "@/lib/webagent.functions";
import { Button } from "@/components/ui/button";
import { formatCZK, formatNumber } from "@/lib/format";
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
import { cityCentroid, haversineKm, locationMatches, roomsMatch } from "@/lib/webagent";

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
    const radiusKm = num(f.radius);
    const center = f.location.trim() ? cityCentroid(f.location) : null;

    return data
      .filter((e) => isActive(e.listing.availability_status as never))
      .map((e) => ({
        e,
        cf: e.listing.price && e.rent ? calculateTotalReturn(defaultInvestmentInput(e.listing.price, e.rent, { ltvBps })).monthlyCashFlow : null,
      }))
      .filter(({ e, cf }) => {
        // Location: normalized city match
        if (f.location && !locationMatches(e.city, f.location)) return false;

        // Radius: only when both radius and a known center exist; prefer listing coords, fall back to city centroid
        if (radiusKm != null && radiusKm > 0 && center) {
          const lat = e.listing.latitude ?? e.property?.latitude ?? null;
          const lng = e.listing.longitude ?? e.property?.longitude ?? null;
          if (lat != null && lng != null) {
            if (haversineKm(center.lat, center.lng, Number(lat), Number(lng)) > radiusKm) return false;
          } else {
            // No coords → allow only exact city match (already applied above)
          }
        }

        if (f.type !== "all" && e.listing.property_type && e.listing.property_type !== f.type) return false;
        if (f.rooms && !roomsMatch(e.listing.rooms, f.rooms)) return false;
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

      <WebAgentBox />

      <div className="grid grid-cols-2 gap-3 rounded-md border bg-card p-4 md:grid-cols-5">
        <F label="Lokalita"><Input value={f.location} onChange={set("location")} placeholder="např. Brno" /></F>
        <F label="Radius (km)">
          <Input
            value={f.radius}
            onChange={set("radius")}
            inputMode="numeric"
            placeholder="např. 20"
            disabled={!f.location.trim()}
            title={!f.location.trim() ? "Nejdřív zadejte lokalitu" : "Vzdálenost od středu města (vyžaduje GPS u inzerátu)"}
          />
        </F>
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

function ago(iso: string | null) {
  if (!iso) return "neověřeno";
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 60 ? `Ověřeno před ${m} min.` : `Ověřeno před ${Math.round(m / 60)} h`;
}

function WebAgentBox() {
  const run = useServerFn(runWebAgent);
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(listingsQuery);
  const [q, setQ] = useState("2+kk Pardubice do 5 000 000 Kč, výnos min. 5 %");
  const [phase, setPhase] = useState<"idle" | "searching" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [ids, setIds] = useState<string[]>([]);
  const [failed, setFailed] = useState<{ url: string; reason: string }[]>([]);

  const go = async () => {
    setPhase("searching"); setMsg("Vyhledávám veřejné nabídky a analyzuji je…"); setIds([]); setFailed([]);
    try {
      const r = await run({ data: { query: q } });
      if (!r.ok) { setPhase("error"); setMsg(r.error); return; }
      await qc.invalidateQueries({ queryKey: ["listings"] });
      setIds(r.listingIds); setFailed(r.failed); setPhase("done");
      setMsg(`Našel jsem ${r.pagesFound} relevantních stránek, analyzoval ${r.analyzed}. Nalezeno ${r.listingIds.length} použitelných nabídek.`);
    } catch {
      setPhase("error"); setMsg("Webové vyhledávání není momentálně dostupné.");
    }
  };
  const found = data.filter((e) => ids.includes(e.listing.id));

  return (
    <div className="space-y-3 rounded-md border bg-card p-4">
      <Label className="text-xs text-muted-foreground">AI Web Agent – co hledáš?</Label>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void go(); }}>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="2+kk Pardubice do 5 000 000 Kč" />
        <Button type="submit" disabled={phase === "searching" || q.trim().length < 3}>
          {phase === "searching" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}<span className="ml-1.5">Hledat</span>
        </Button>
      </form>
      {msg && <p className={phase === "error" ? "text-sm text-negative" : "text-sm text-muted-foreground"}>{msg}</p>}
      {found.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {found.map((e) => (
            <div key={e.listing.id} className="space-y-2">
              <span className="inline-block rounded-sm border border-positive/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-positive">Live data</span>
              <ListingCard e={e} showReasons />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{ago(e.listing.last_verified_at)}{e.listing.area_m2 ? ` · ${formatNumber(Number(e.listing.area_m2))} m²` : ""} · {formatCZK(e.listing.price)}</span>
                <Button asChild size="sm" variant="outline"><a href={e.listing.source_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-1 h-3.5 w-3.5" />Otevřít inzerát</a></Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {failed.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary>Nezpracované stránky ({failed.length})</summary>
          <ul className="mt-1 space-y-0.5">{failed.map((f) => <li key={f.url} className="truncate">{f.reason} – {f.url}</li>)}</ul>
        </details>
      )}
    </div>
  );
}
