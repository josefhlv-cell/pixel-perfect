import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listingsQuery, marketQuery, portfolioQuery, watchlistQuery } from "@/lib/queries";
import { portfolioSeries, portfolioTotals, RANGES, type RangeKey } from "@/lib/portfolio";
import { latestStatsByCity } from "@/lib/deals";
import { formatBps, formatCZK, formatRelative } from "@/lib/format";
import { isActive } from "@/lib/freshness";
import { pageHead } from "@/lib/head";
import { t } from "@/lib/i18n";
import { Empty, Kpi, PageHeader, PriorityBadge, SampleBadge, Section } from "@/components/app/shared";
import { ValueChart, SERIES } from "@/components/app/Charts";
import { AiRunner } from "@/components/app/AiPanel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => pageHead("Dashboard", "Přehled portfolia, dealů, watchlistu a trhu."),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(listingsQuery),
      context.queryClient.ensureQueryData(portfolioQuery),
      context.queryClient.ensureQueryData(watchlistQuery),
      context.queryClient.ensureQueryData(marketQuery),
    ]),
  component: Dashboard,
});

const METRICS = ["value", "equity", "debt", "rent", "cashFlow", "growth"] as const;

function Dashboard() {
  const { data: listings } = useSuspenseQuery(listingsQuery);
  const { data: pf } = useSuspenseQuery(portfolioQuery);
  const { data: wl } = useSuspenseQuery(watchlistQuery);
  const { data: market } = useSuspenseQuery(marketQuery);
  const [range, setRange] = useState<RangeKey>("1R");
  const [metric, setMetric] = useState<(typeof METRICS)[number]>("value");

  const totals = portfolioTotals(pf.properties, pf.valuations);
  const series = useMemo(() => {
    const s = portfolioSeries(pf.properties, pf.valuations, range);
    const base = s[0]?.value ?? 0;
    return s.map((p) => ({ ...p, growth: p.value - base }));
  }, [pf, range]);
  const active = listings.filter((e) => isActive(e.listing.availability_status as never));
  const top = active.slice(0, 4);
  const wlItems = wl.map((w) => listings.find((e) => e.listing.id === w.listing_id)).filter(Boolean).slice(0, 5);
  const stats = [...latestStatsByCity(market).values()].sort((a, b) => (b.avg_asking_price_m2 ?? 0) - (a.avg_asking_price_m2 ?? 0));

  return (
    <div className="space-y-5">
      <PageHeader title="Dashboard" sub={t("app.tagline")} />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Kpi label="Hodnota portfolia" value={formatCZK(totals.value)} sub={`${totals.count} nemovitostí`} />
        <Kpi label="Vlastní kapitál" value={formatCZK(totals.equity)} />
        <Kpi label="Dluh" value={formatCZK(totals.debt)} />
        <Kpi label="Měsíční nájem" value={formatCZK(totals.rent)} />
        <Kpi label="Měsíční cash-flow" value={formatCZK(totals.cashFlow)} tone={totals.cashFlow >= 0 ? "pos" : "neg"} />
        <Kpi label="Průměrný výnos" value={totals.yieldBps == null ? "—" : formatBps(totals.yieldBps)} sub="hrubý, z kupní ceny" />
        <Kpi label="Aktivní dealy" value={active.length} sub={<span className="inline-flex items-center gap-1">vč. <SampleBadge /></span>} />
        <Kpi label="Watchlist" value={wl.length} />
      </div>

      <Section
        title="Vývoj portfolia"
        right={
          <div className="flex gap-0.5">
            {(Object.keys(RANGES) as RangeKey[]).map((r) => (
              <button key={r} onClick={() => setRange(r)} className={cn("num rounded px-2 py-0.5 text-[11px]", r === range ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{r}</button>
            ))}
          </div>
        }
      >
        <div className="mb-3 flex flex-wrap gap-1">
          {METRICS.map((m) => (
            <Button key={m} size="sm" variant={m === metric ? "secondary" : "ghost"} className="h-7 text-xs" onClick={() => setMetric(m)}>{SERIES[m]!.label}</Button>
          ))}
        </div>
        {pf.properties.length ? <ValueChart data={series} keys={[metric]} /> : <Empty>{t("empty.portfolio")} <Link to="/portfolio" className="text-primary hover:underline">Přidat nemovitost</Link></Empty>}
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Deal Hunter · top příležitosti" right={<Link to="/deals" className="text-xs text-primary hover:underline">Vše →</Link>}>
          <div className="mb-2 text-xs text-muted-foreground">Zdroj: <SampleBadge /> – datový zdroj není připojen.</div>
          <ul className="divide-y">
            {top.map((e) => (
              <li key={e.listing.id}>
                <Link to="/properties/$id" params={{ id: e.listing.id }} className="flex items-center gap-3 py-2 hover:text-primary">
                  <PriorityBadge value={e.priority} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{e.listing.title}</div>
                    <div className="text-xs text-muted-foreground">{e.city} · výnos {formatBps(e.grossYieldBps)}</div>
                  </div>
                  <div className="num text-sm">{formatCZK(e.listing.price)}</div>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Watchlist · poslední změny" right={<Link to="/watchlist" className="text-xs text-primary hover:underline">Vše →</Link>}>
          {wlItems.length === 0 ? <Empty>{t("empty.watchlist")}</Empty> : (
            <ul className="divide-y">
              {wlItems.map((e) => e && (
                <li key={e.listing.id}>
                  <Link to="/properties/$id" params={{ id: e.listing.id }} className="flex items-center justify-between gap-3 py-2 text-sm hover:text-primary">
                    <span className="truncate">{e.listing.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">ověřeno {formatRelative(e.listing.last_verified_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Trh · cena za m²" right={<SampleBadge />}>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground"><th className="pb-1 font-normal">Město</th><th className="pb-1 text-right font-normal">Kč/m²</th><th className="pb-1 text-right font-normal">Nájem Kč/m²</th></tr></thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.city} className="border-t border-border/50"><td className="py-1.5">{s.city}</td><td className="num text-right">{formatCZK(s.avg_asking_price_m2)}</td><td className="num text-right">{formatCZK(s.avg_rent_m2)}</td></tr>
              ))}
            </tbody>
          </table>
        </Section>
        <Section title="AI Insight">
          <p className="mb-3 text-sm text-muted-foreground">Krátké shrnutí trhu z dostupných (ukázkových) dat.</p>
          <AiRunner kind="market" label="Vygenerovat insight" />
        </Section>
      </div>
      <p className="text-xs text-muted-foreground">{t("disclaimer")}</p>
    </div>
  );
}
