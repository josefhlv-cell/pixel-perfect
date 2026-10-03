import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { LayoutGrid, List, Map as MapIcon } from "lucide-react";
import { listingsQuery } from "@/lib/queries";
import { formatBps, formatCZK, formatNumber } from "@/lib/format";
import { pageHead } from "@/lib/head";
import { t } from "@/lib/i18n";
import { ListingCard } from "@/components/app/ListingCard";
import { AvailabilityBadge, Empty, FreshnessBadge, PageHeader, PriorityBadge, SampleBadge } from "@/components/app/shared";
import { MapLazy } from "@/components/app/MapLazy";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export const Route = createFileRoute("/_authenticated/properties/")({
  head: () => pageHead("Nemovitosti", "Prohlížeč nabídek s filtry, řazením a mapou."),
  loader: ({ context }) => context.queryClient.ensureQueryData(listingsQuery),
  component: Properties,
});

const PAGE = 12;
type SortKey = "priority" | "price" | "ppm2" | "yield" | "cashflow" | "area";

function Properties() {
  const { data } = useSuspenseQuery(listingsQuery);
  const navigate = useNavigate();
  const [view, setView] = useState<"list" | "cards" | "map">("list");
  const [q, setQ] = useState("");
  const [f, setF] = useState({ city: "all", priceMin: "", priceMax: "", ppm2Max: "", areaMin: "", areaMax: "", rooms: "", type: "all", yieldMin: "", cfMin: "", prioMin: "", fresh: "all", avail: "all", source: "all" });
  const [sort, setSort] = useState<SortKey>("priority");
  const [page, setPage] = useState(0);
  const up = (k: keyof typeof f) => (v: string) => { setF({ ...f, [k]: v }); setPage(0); };
  const n = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));

  const cities = [...new Set(data.map((e) => e.city).filter(Boolean))] as string[];
  const sources = [...new Set(data.map((e) => e.listing.source_domain))];

  const rows = useMemo(() => {
    const ql = q.toLowerCase();
    const out = data.filter((e) => {
      const l = e.listing;
      if (ql && !`${l.title} ${e.city} ${l.address ?? ""} ${l.rooms ?? ""}`.toLowerCase().includes(ql)) return false;
      if (f.city !== "all" && e.city !== f.city) return false;
      if (n(f.priceMin) != null && (l.price ?? 0) < n(f.priceMin)!) return false;
      if (n(f.priceMax) != null && (l.price ?? Infinity) > n(f.priceMax)!) return false;
      if (n(f.ppm2Max) != null && (e.pricePerM2 ?? Infinity) > n(f.ppm2Max)!) return false;
      if (n(f.areaMin) != null && Number(l.area_m2 ?? 0) < n(f.areaMin)!) return false;
      if (n(f.areaMax) != null && Number(l.area_m2 ?? Infinity) > n(f.areaMax)!) return false;
      if (f.rooms && !(l.rooms ?? "").includes(f.rooms)) return false;
      if (f.type !== "all" && l.property_type !== f.type) return false;
      if (n(f.yieldMin) != null && (e.grossYieldBps ?? -1) < n(f.yieldMin)! * 100) return false;
      if (n(f.cfMin) != null && (e.monthlyCashFlow ?? -1e12) < n(f.cfMin)!) return false;
      if (n(f.prioMin) != null && e.priority < n(f.prioMin)!) return false;
      if (f.fresh !== "all" && l.freshness_status !== f.fresh) return false;
      if (f.avail !== "all" && l.availability_status !== f.avail) return false;
      if (f.source !== "all" && l.source_domain !== f.source) return false;
      return true;
    });
    const key: Record<SortKey, (e: (typeof data)[number]) => number> = {
      priority: (e) => -e.priority,
      price: (e) => e.listing.price ?? Infinity,
      ppm2: (e) => e.pricePerM2 ?? Infinity,
      yield: (e) => -(e.grossYieldBps ?? -1),
      cashflow: (e) => -(e.monthlyCashFlow ?? -1e12),
      area: (e) => -Number(e.listing.area_m2 ?? 0),
    };
    return out.sort((a, b) => key[sort](a) - key[sort](b));
  }, [data, q, f, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const slice = rows.slice(page * PAGE, page * PAGE + PAGE);
  const types = [...new Set(data.map((e) => e.listing.property_type).filter(Boolean))] as string[];

  const sel = (k: keyof typeof f, label: string, opts: [string, string][]) => (
    <Select value={f[k]} onValueChange={up(k)}>
      <SelectTrigger className="h-9 text-xs" aria-label={label}><SelectValue placeholder={label} /></SelectTrigger>
      <SelectContent><SelectItem value="all">{label}: vše</SelectItem>{opts.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
    </Select>
  );
  const inp = (k: keyof typeof f, ph: string) => <Input className="h-9 text-xs" placeholder={ph} value={f[k]} onChange={(e) => up(k)(e.target.value)} inputMode="decimal" aria-label={ph} />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Nemovitosti"
        sub={<span className="inline-flex items-center gap-2"><span className="num">{rows.length}</span> nabídek · <SampleBadge /></span>}
        actions={
          <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as typeof view)} variant="outline" size="sm">
            <ToggleGroupItem value="list" aria-label="Seznam"><List className="h-4 w-4" /></ToggleGroupItem>
            <ToggleGroupItem value="cards" aria-label="Karty"><LayoutGrid className="h-4 w-4" /></ToggleGroupItem>
            <ToggleGroupItem value="map" aria-label="Mapa"><MapIcon className="h-4 w-4" /></ToggleGroupItem>
          </ToggleGroup>
        }
      />
      <div className="grid grid-cols-2 gap-2 rounded-md border bg-card p-3 sm:grid-cols-4 lg:grid-cols-8">
        <Input className="col-span-2 h-9 text-xs" placeholder="Hledat název, adresu, dispozici…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        {sel("city", "Lokalita", cities.map((c) => [c, c]))}
        {inp("priceMin", "Cena od")}
        {inp("priceMax", "Cena do")}
        {inp("ppm2Max", "Max Kč/m²")}
        {inp("areaMin", "Plocha od")}
        {inp("areaMax", "Plocha do")}
        <Input className="h-9 text-xs" placeholder="Dispozice" value={f.rooms} onChange={(e) => up("rooms")(e.target.value)} />
        {sel("type", "Typ", types.map((x) => [x, x]))}
        {inp("yieldMin", "Min. výnos %")}
        {inp("cfMin", "Min. cash-flow")}
        {inp("prioMin", "Min. Deal Priority")}
        {sel("fresh", "Freshness", ["FRESH", "RECENT", "AGING", "STALE", "EXPIRED", "UNKNOWN"].map((s) => [s, t(`freshness.${s}`)]))}
        {sel("avail", "Stav", ["ACTIVE_CONFIRMED", "ACTIVE_UNCONFIRMED", "RESERVED", "SOLD", "REMOVED", "EXPIRED"].map((s) => [s, t(`availability.${s}`)]))}
        {sel("source", "Zdroj", sources.map((s) => [s, s]))}
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="h-9 text-xs" aria-label="Řazení"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="priority">Řadit: Deal Priority</SelectItem>
            <SelectItem value="price">Řadit: cena ↑</SelectItem>
            <SelectItem value="ppm2">Řadit: Kč/m² ↑</SelectItem>
            <SelectItem value="yield">Řadit: výnos ↓</SelectItem>
            <SelectItem value="cashflow">Řadit: cash-flow ↓</SelectItem>
            <SelectItem value="area">Řadit: plocha ↓</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 ? <Empty>Žádná nabídka neodpovídá filtrům.</Empty> : view === "map" ? (
        <MapLazy
          onOpen={(href) => navigate({ to: "/properties/$id", params: { id: href } })}
          points={rows.filter((e) => e.listing.latitude != null).map((e) => ({
            id: e.listing.id, lat: e.listing.latitude!, lng: e.listing.longitude!, title: e.listing.title ?? "",
            subtitle: `${formatCZK(e.listing.price)} · DP ${e.priority}`, layer: e.priority >= 50 ? "deal" : "listing", href: e.listing.id,
          }))}
        />
      ) : view === "cards" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{slice.map((e) => <ListingCard key={e.listing.id} e={e} />)}</div>
      ) : (
        <div className="overflow-x-auto rounded-md border bg-card">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>{["DP", "Nabídka", "Cena", "Kč/m²", "m²", "Výnos", "Cash-flow", "Freshness", "Stav", "Zdroj"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {slice.map((e) => (
                <tr key={e.listing.id} onClick={() => navigate({ to: "/properties/$id", params: { id: e.listing.id } })} className="cursor-pointer border-b border-border/50 hover:bg-accent/50">
                  <td className="px-3 py-2"><PriorityBadge value={e.priority} /></td>
                  <td className="px-3 py-2"><div className="font-medium">{e.listing.title}</div><div className="flex items-center gap-1.5 text-xs text-muted-foreground">{e.isSample && <SampleBadge />}{e.city} · {e.listing.rooms}</div></td>
                  <td className="num px-3 py-2">{formatCZK(e.listing.price)}</td>
                  <td className="num px-3 py-2">{formatCZK(e.pricePerM2)}</td>
                  <td className="num px-3 py-2">{formatNumber(Number(e.listing.area_m2))}</td>
                  <td className="num px-3 py-2">{formatBps(e.grossYieldBps)}</td>
                  <td className={`num px-3 py-2 ${(e.monthlyCashFlow ?? 0) < 0 ? "text-negative" : "text-positive"}`}>{formatCZK(e.monthlyCashFlow)}</td>
                  <td className="px-3 py-2"><FreshnessBadge status={e.listing.freshness_status} /></td>
                  <td className="px-3 py-2"><AvailabilityBadge status={e.listing.availability_status} /></td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{e.listing.source_domain}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {view !== "map" && pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Předchozí</Button>
          <span className="num text-muted-foreground">{page + 1} / {pages}</span>
          <Button size="sm" variant="outline" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Další</Button>
        </div>
      )}
    </div>
  );
}
