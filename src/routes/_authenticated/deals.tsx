import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { BellRing, Download, ExternalLink, Loader2, MapPin, Save, Search, Trash2, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { runWebAgent } from "@/lib/webagent.functions";
import { addWatch, listWatches, removeWatch } from "@/lib/watchdog.functions";
import { useQuery } from "@tanstack/react-query";
import { geocodePlace } from "@/lib/geocode.functions";
import type { GeoPoint } from "@/lib/geocode";
import { Button } from "@/components/ui/button";
import { formatBps, formatCZK, formatNumber } from "@/lib/format";
import { listingsQuery, profileQuery } from "@/lib/queries";
import { calculateTotalReturn } from "@/lib/calculations";
import { defaultInvestmentInput, type EnrichedListing } from "@/lib/deals";
import { isActive } from "@/lib/freshness";
import { pageHead } from "@/lib/head";
import { ListingCard } from "@/components/app/ListingCard";
import { ComparePanel } from "@/components/app/ComparePanel";
import { Empty, PageHeader, SampleBadge } from "@/components/app/shared";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cityCentroid, haversineKm, locationMatches, roomsMatch } from "@/lib/webagent";
import { downloadCsv } from "@/lib/export";
import { deleteFilterPreset, loadSavedFilters, saveFilterPreset, type DealFilters, type SavedFilter } from "@/lib/saved-filters";

export const Route = createFileRoute("/_authenticated/deals")({
  head: () => pageHead("Deal Hunter", "Potenciální investiční dealy s transparentním Deal Priority."),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(listingsQuery), context.queryClient.ensureQueryData(profileQuery)]),
  component: DealHunter,
});

type Strategy = "cashflow" | "yield" | "discount" | "priority" | "distance";

function DealHunter() {
  const { data } = useSuspenseQuery(listingsQuery);
  const { data: prof } = useSuspenseQuery(profileQuery);
  const inv = prof.investor;
  const geocode = useServerFn(geocodePlace);

  const [f, setF] = useState<DealFilters & { strategy: Strategy }>({
    location: inv?.locations?.[0] ?? "",
    radius: "",
    type: "all",
    rooms: "",
    maxPrice: inv?.max_price ? String(inv.max_price) : "",
    minYield: inv?.min_gross_yield_bps ? String(inv.min_gross_yield_bps / 100) : "",
    minDiscount: "",
    minCashFlow: "",
    maxLtv: inv?.ltv_bps ? String(inv.ltv_bps / 100) : "80",
    strategy: "priority",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));

  const [origin, setOrigin] = useState<GeoPoint | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [geoError, setGeoError] = useState("");

  const [saved, setSaved] = useState<SavedFilter[]>(() => (typeof window !== "undefined" ? loadSavedFilters() : []));
  const [presetName, setPresetName] = useState("");
  const [compareIds, setCompareIds] = useState<string[]>([]);

  useEffect(() => {
    const loc = f.location.trim();
    const radiusKm = num(f.radius);
    if (!loc || radiusKm == null || radiusKm <= 0) {
      setOrigin(null);
      setGeoStatus("idle");
      setGeoError("");
      return;
    }
    const centroid = cityCentroid(loc);
    if (centroid && !/[0-9]/.test(loc) && loc.split(/\s+/).length <= 2) {
      setOrigin({ lat: centroid.lat, lng: centroid.lng, displayName: loc });
      setGeoStatus("ok");
      setGeoError("");
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setGeoStatus("loading");
      setGeoError("");
      try {
        const r = await geocode({ data: { query: loc } });
        if (cancelled) return;
        if (r.ok) {
          setOrigin(r.point);
          setGeoStatus("ok");
        } else if (!centroid) {
          setOrigin(null);
          setGeoStatus("error");
          setGeoError(r.error);
        } else setGeoStatus("ok");
      } catch {
        if (cancelled) return;
        if (!centroid) {
          setOrigin(null);
          setGeoStatus("error");
          setGeoError("Geokódování selhalo.");
        } else setGeoStatus("ok");
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [f.location, f.radius]); // eslint-disable-line react-hooks/exhaustive-deps

  const results = useMemo(() => {
    const ltvBps = Math.round((num(f.maxLtv) ?? 80) * 100);
    const radiusKm = num(f.radius);
    const useDistance = radiusKm != null && radiusKm > 0 && origin != null;

    return data
      .filter((e) => isActive(e.listing.availability_status as never))
      .map((e) => {
        const lat = e.listing.latitude ?? e.property?.latitude ?? null;
        const lng = e.listing.longitude ?? e.property?.longitude ?? null;
        let distanceKm: number | null = null;
        if ((useDistance || f.strategy === "distance") && origin && lat != null && lng != null) {
          distanceKm = haversineKm(origin.lat, origin.lng, Number(lat), Number(lng));
        }
        return {
          e,
          cf: e.listing.price && e.rent ? calculateTotalReturn(defaultInvestmentInput(e.listing.price, e.rent, { ltvBps })).monthlyCashFlow : null,
          distanceKm,
        };
      })
      .filter(({ e, cf, distanceKm }) => {
        if (useDistance) {
          if (distanceKm == null) return false;
          if (distanceKm > radiusKm!) return false;
        } else if (f.location.trim()) {
          if (!locationMatches(e.city, f.location)) return false;
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
        if (f.strategy === "distance") return (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9);
        if (f.strategy === "cashflow") return (b.cf ?? -1e12) - (a.cf ?? -1e12);
        if (f.strategy === "yield") return (b.e.grossYieldBps ?? -1) - (a.e.grossYieldBps ?? -1);
        if (f.strategy === "discount") return (a.e.diffBps ?? 1e9) - (b.e.diffBps ?? 1e9);
        const pd = b.e.priority - a.e.priority;
        if (pd !== 0) return pd;
        if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm;
        return 0;
      });
  }, [data, f, origin]);

  const compareItems = useMemo(
    () => compareIds.map((id) => data.find((x) => x.listing.id === id)).filter(Boolean) as EnrichedListing[],
    [compareIds, data],
  );

  const onSelect = (id: string, next: boolean) => {
    setCompareIds((prev) => {
      if (next) return prev.includes(id) ? prev : prev.length >= 3 ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  };

  const exportCsv = () => {
    downloadCsv(
      `deals-${new Date().toISOString().slice(0, 10)}.csv`,
      results.map(({ e, distanceKm }) => ({
        title: e.listing.title,
        city: e.city,
        price: e.listing.price,
        area_m2: e.listing.area_m2,
        rooms: e.listing.rooms,
        price_per_m2: e.pricePerM2,
        gross_yield_pct: e.grossYieldBps != null ? (e.grossYieldBps / 100).toFixed(2) : "",
        cash_flow: e.monthlyCashFlow,
        priority: e.priority,
        distance_km: distanceKm != null ? distanceKm.toFixed(2) : "",
        source_url: e.listing.source_url,
      })),
    );
    toast.success("CSV staženo");
  };

  const savePreset = () => {
    const name = presetName.trim() || `Filtr ${new Date().toLocaleDateString("cs-CZ")}`;
    const next = saveFilterPreset(name, f);
    setSaved(next);
    setPresetName("");
    toast.success("Filtr uložen");
  };

  const applyPreset = (p: SavedFilter) => {
    setF({ ...p.filters, strategy: (p.filters.strategy as Strategy) || "priority" });
    toast.message(`Načten filtr: ${p.name}`);
  };

  return (
    <div className={`space-y-5 ${compareItems.length >= 2 ? "pb-56" : ""}`}>
      <PageHeader
        title="Deal Hunter"
        sub="Nastavte kritéria. Každý výsledek ukazuje, proč se shoduje – i co mluví proti."
        actions={
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={results.length === 0}>
            <Download className="mr-1.5 h-4 w-4" />Export CSV
          </Button>
        }
      />

      <WebAgentBox />

      <div className="grid grid-cols-2 gap-3 rounded-md border bg-card p-4 md:grid-cols-5">
        <F label="Adresa / lokalita"><Input value={f.location} onChange={set("location")} placeholder="např. Pardubice, Zelené Předměstí" /></F>
        <F label="Vzdálenost (km)">
          <Input value={f.radius} onChange={set("radius")} inputMode="numeric" placeholder="např. 15" disabled={!f.location.trim()} />
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
              <SelectItem value="distance">Vzdálenost</SelectItem>
            </SelectContent>
          </Select>
        </F>
      </div>

      {/* Saved filters */}
      <div className="flex flex-wrap items-end gap-2 rounded-md border bg-card p-3">
        <div className="min-w-[160px] flex-1 space-y-1">
          <Label className="text-xs text-muted-foreground">Uložit aktuální filtr jako</Label>
          <Input value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="např. Brno 2+kk do 5M" />
        </div>
        <Button size="sm" variant="secondary" onClick={savePreset}><Save className="mr-1.5 h-4 w-4" />Uložit</Button>
        {saved.length > 0 && (
          <div className="flex w-full flex-wrap gap-1.5 pt-1">
            {saved.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
                <button type="button" className="hover:text-primary" onClick={() => applyPreset(p)}>{p.name}</button>
                <button type="button" className="text-muted-foreground hover:text-negative" aria-label="Smazat" onClick={() => setSaved(deleteFilterPreset(p.id))}>
                  <Trash2 className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {f.location.trim() && num(f.radius) != null && num(f.radius)! > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {geoStatus === "loading" && <><Loader2 className="h-3.5 w-3.5 animate-spin" />Hledám polohu adresy…</>}
          {geoStatus === "ok" && origin && (
            <><MapPin className="h-3.5 w-3.5 text-primary" />Střed: <span className="font-medium text-foreground">{origin.displayName}</span> · do {num(f.radius)} km</>
          )}
          {geoStatus === "error" && <span className="text-negative">{geoError || "Adresu se nepodařilo najít."}</span>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Potential deals</h2>
        <span className="num text-xs text-muted-foreground">({results.length})</span>
        <SampleBadge />
        {compareIds.length > 0 && (
          <span className="text-xs text-muted-foreground">Porovnání: {compareIds.length}/3</span>
        )}
      </div>
      {results.length === 0 ? (
        <Empty>Kritériím neodpovídá žádná nabídka. Zkuste je uvolnit.</Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {results.map(({ e, distanceKm }) => (
            <ListingCard
              key={e.listing.id}
              e={e}
              showReasons
              selectable
              selected={compareIds.includes(e.listing.id)}
              onSelect={onSelect}
              distanceKm={distanceKm}
            />
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Deal Priority = sleva (35) + výnos (30) + čerstvost (20) + dostupnost (10) + snížení ceny (5).
        Zaškrtněte až 3 nabídky pro porovnání. Export CSV exportuje aktuálně vyfiltrované výsledky.
      </p>

      {compareItems.length >= 2 && (
        <ComparePanel
          items={compareItems}
          onClose={() => setCompareIds([])}
          onRemove={(id) => setCompareIds((p) => p.filter((x) => x !== id))}
        />
      )}
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
  const listW = useServerFn(listWatches);
  const addW = useServerFn(addWatch);
  const remW = useServerFn(removeWatch);
  const watches = useQuery({ queryKey: ["watches"], queryFn: () => listW() });
  const watch = async () => {
    const r = await addW({ data: { query: q } });
    if (!r.ok) { toast.error(r.error); return; }
    toast.success("Hledání se bude každý den opakovat. Nové nabídky a slevy uvidíte v Upozorněních.");
    await qc.invalidateQueries({ queryKey: ["watches"] });
  };
  const unwatch = async (id: string) => {
    await remW({ data: { id } });
    await qc.invalidateQueries({ queryKey: ["watches"] });
  };

  return (
    <div className="space-y-3 rounded-md border bg-card p-4">
      <Label className="text-xs text-muted-foreground">AI Web Agent – co hledáš?</Label>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void go(); }}>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="2+kk Pardubice do 5 000 000 Kč" />
        <Button type="submit" disabled={phase === "searching" || q.trim().length < 3}>
          {phase === "searching" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}<span className="ml-1.5">Hledat</span>
        </Button>
        <Button type="button" variant="outline" title="Hlídat denně" disabled={q.trim().length < 3} onClick={() => void watch()}>
          <BellRing className="h-4 w-4" /><span className="ml-1.5 hidden sm:inline">Hlídat denně</span>
        </Button>
      </form>
      {(watches.data?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="text-muted-foreground">Hlídací pes:</span>
          {watches.data!.map((w) => (
            <span key={w.id} className="inline-flex items-center gap-1 rounded-sm border px-2 py-0.5">
              {w.query}{w.last_run_at ? ` · ${new Date(w.last_run_at).toLocaleDateString("cs-CZ")}` : " · čeká"}
              <button type="button" aria-label="Zrušit hlídání" onClick={() => void unwatch(w.id)}><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
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
