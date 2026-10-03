import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listingsQuery, portfolioQuery, watchlistQuery } from "@/lib/queries";
import { formatCZK } from "@/lib/format";
import { pageHead } from "@/lib/head";
import { PageHeader, SampleBadge } from "@/components/app/shared";
import { MapLazy, type MapPoint } from "@/components/app/MapLazy";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/map")({
  head: () => pageHead("Mapa", "Nabídky, potenciální dealy, portfolio a watchlist na mapě."),
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(listingsQuery), context.queryClient.ensureQueryData(portfolioQuery), context.queryClient.ensureQueryData(watchlistQuery)]),
  component: MapPage,
});

const LAYERS = [
  { k: "listing", label: "Nabídky", color: "#8b93a7" },
  { k: "deal", label: "Potenciální dealy (DP ≥ 50)", color: "#e8b34a" },
  { k: "portfolio", label: "Portfolio", color: "#3fbf7f" },
  { k: "watchlist", label: "Watchlist", color: "#b07cf0" },
] as const;

function MapPage() {
  const { data: listings } = useSuspenseQuery(listingsQuery);
  const { data: pf } = useSuspenseQuery(portfolioQuery);
  const { data: wl } = useSuspenseQuery(watchlistQuery);
  const navigate = useNavigate();
  const [on, setOn] = useState<Record<string, boolean>>({ listing: true, deal: true, portfolio: true, watchlist: true });

  const points = useMemo(() => {
    const out: MapPoint[] = [];
    const wlIds = new Set(wl.map((w) => w.listing_id));
    for (const e of listings) {
      if (e.listing.latitude == null || e.listing.longitude == null) continue;
      const layer: MapPoint["layer"] = wlIds.has(e.listing.id) ? "watchlist" : e.priority >= 50 ? "deal" : "listing";
      if (!on[layer]) continue;
      out.push({ id: e.listing.id, lat: e.listing.latitude, lng: e.listing.longitude, title: e.listing.title ?? "", subtitle: `${formatCZK(e.listing.price)} · DP ${e.priority}${e.isSample ? " · SAMPLE DATA" : ""}`, layer, href: e.listing.id });
    }
    if (on["portfolio"]) {
      for (const p of pf.properties) {
        const e = listings.find((x) => x.listing.property_id === p.property_id && x.listing.latitude != null);
        if (!e) continue;
        out.push({ id: `pf-${p.id}`, lat: e.listing.latitude! + 0.0004, lng: e.listing.longitude! + 0.0004, title: p.name, subtitle: `Portfolio · ${formatCZK(p.current_value ?? p.purchase_price)}`, layer: "portfolio", href: e.listing.id });
      }
    }
    return out;
  }, [listings, pf, wl, on]);

  return (
    <div className="space-y-4">
      <PageHeader title="Mapa" sub={<span className="inline-flex items-center gap-2">Klikněte na bod pro kartu nemovitosti · <SampleBadge /></span>} />
      <div className="flex flex-wrap gap-4 rounded-md border bg-card p-3">
        {LAYERS.map((l) => (
          <div key={l.k} className="flex items-center gap-2">
            <Switch id={`layer-${l.k}`} checked={!!on[l.k]} onCheckedChange={(c) => setOn({ ...on, [l.k]: c })} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
            <Label htmlFor={`layer-${l.k}`} className="text-sm">{l.label}</Label>
          </div>
        ))}
      </div>
      <MapLazy points={points} onOpen={(id) => navigate({ to: "/properties/$id", params: { id } })} height={600} />
      <p className="text-xs text-muted-foreground">Portfolio se zobrazí, pokud je nemovitost propojená se záznamem s polohou.</p>
    </div>
  );
}
