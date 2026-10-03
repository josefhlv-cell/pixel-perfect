import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { freshnessEventsQuery, listingsQuery, removeFromWatchlist, watchlistQuery } from "@/lib/queries";
import { formatCZK, formatRelative } from "@/lib/format";
import { pageHead } from "@/lib/head";
import { t } from "@/lib/i18n";
import { AvailabilityBadge, Delta, Empty, FreshnessBadge, PageHeader, PriorityBadge, SampleBadge } from "@/components/app/shared";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/watchlist")({
  head: () => pageHead("Watchlist", "Uložené nabídky a historie změn ceny, čerstvosti a dostupnosti."),
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(watchlistQuery), context.queryClient.ensureQueryData(listingsQuery), context.queryClient.ensureQueryData(freshnessEventsQuery)]),
  component: Watchlist,
});

function Watchlist() {
  const { data: wl } = useSuspenseQuery(watchlistQuery);
  const { data: listings } = useSuspenseQuery(listingsQuery);
  const { data: events } = useSuspenseQuery(freshnessEventsQuery);
  const qc = useQueryClient();

  const remove = async (id: string) => {
    await removeFromWatchlist(id);
    await qc.invalidateQueries({ queryKey: ["watchlist"] });
    toast.success("Odebráno z Watchlistu");
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Watchlist" sub="Historie změn je čtena z databáze (append-only snapshoty a události ověření)." />
      {wl.length === 0 ? <Empty>{t("empty.watchlist")} <Link to="/deals" className="text-primary hover:underline">Deal Hunter</Link></Empty> : wl.map((w) => {
        const e = listings.find((x) => x.listing.id === w.listing_id);
        if (!e) return null;
        const prices = e.priceHistory.filter((h) => h.price != null);
        const first = prices[0]?.price ?? null;
        const last = prices[prices.length - 1]?.price ?? null;
        const ev = events.filter((x) => x.listing_id === e.listing.id).slice(0, 5);
        return (
          <div key={w.id} className="rounded-md border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <Link to="/properties/$id" params={{ id: e.listing.id }} className="min-w-0 hover:text-primary">
                <div className="flex items-center gap-1.5">{e.isSample && <SampleBadge />}<span className="text-xs text-muted-foreground">uloženo {formatRelative(w.created_at)}</span></div>
                <div className="mt-1 font-medium">{e.listing.title}</div>
                <div className="text-xs text-muted-foreground">{e.city}</div>
              </Link>
              <div className="flex items-center gap-2">
                <PriorityBadge value={e.priority} />
                <Button size="icon" variant="ghost" aria-label="Odebrat" onClick={() => remove(w.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="mt-3 grid gap-4 md:grid-cols-3">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Cena</div>
                {prices.length >= 2 && first !== last ? (
                  <div className="num mt-1 text-sm">
                    <div className="text-muted-foreground line-through">{formatCZK(first)}</div>
                    <div>↓ {formatCZK(last)}</div>
                    <Delta value={last! - first!} pct={((last! - first!) / first!) * 100} />
                  </div>
                ) : (
                  <div className="num mt-1 text-sm">{formatCZK(e.listing.price)} <span className="block text-xs text-muted-foreground">beze změny ({prices.length} pozorování)</span></div>
                )}
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Stav</div>
                <div className="mt-1 flex flex-wrap gap-1.5"><FreshnessBadge status={e.listing.freshness_status} /><AvailabilityBadge status={e.listing.availability_status} /></div>
                <div className="mt-1 text-xs text-muted-foreground">ověřeno {formatRelative(e.listing.last_verified_at)}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Události</div>
                {ev.length === 0 ? <div className="mt-1 text-xs text-muted-foreground">Zatím žádné změny dostupnosti ani čerstvosti.</div> : (
                  <ul className="mt-1 space-y-0.5 text-xs">
                    {ev.map((x) => (
                      <li key={x.id}>
                        <span className="text-muted-foreground">{new Date(x.created_at).toLocaleDateString("cs-CZ")}</span>{" "}
                        {x.previous_status && x.new_status && x.previous_status !== x.new_status ? `${t(`availability.${x.previous_status}`)} → ${t(`availability.${x.new_status}`)}` : x.freshness_status ? `Čerstvost: ${t(`freshness.${x.freshness_status}`)}` : x.event_type}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
