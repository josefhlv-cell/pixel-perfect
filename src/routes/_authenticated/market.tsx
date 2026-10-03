import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { marketQuery } from "@/lib/queries";
import { formatCZK } from "@/lib/format";
import { pageHead } from "@/lib/head";
import { Kpi, PageHeader, SampleBadge, Section } from "@/components/app/shared";
import { Bars, MultiLine } from "@/components/app/Charts";
import { AiRunner } from "@/components/app/AiPanel";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/market")({
  head: () => pageHead("Trh", "Cena za m², trend cen a nájmů, regionální srovnání."),
  loader: ({ context }) => context.queryClient.ensureQueryData(marketQuery),
  component: Market,
});

const RANGE = { "3M": 3, "6M": 6, "1R": 12, "3R": 36 } as const;
type R = keyof typeof RANGE;

function Market() {
  const { data } = useSuspenseQuery(marketQuery);
  const [range, setRange] = useState<R>("1R");
  const latestPeriod = data.reduce((m, r) => (r.period > m ? r.period : m), "");
  const filtered = useMemo(() => {
    const end = new Date(latestPeriod);
    const start = new Date(end.getFullYear(), end.getMonth() - RANGE[range], 1).toISOString().slice(0, 10);
    return data.filter((r) => r.period > start);
  }, [data, range, latestPeriod]);
  const cities = [...new Set(data.map((r) => r.city))];
  const periods = [...new Set(filtered.map((r) => r.period))].sort();
  const pivot = (k: "avg_asking_price_m2" | "avg_rent_m2") =>
    periods.map((p) => {
      const row: Record<string, string | number> = { label: new Date(p).toLocaleDateString("cs-CZ", { month: "short", year: "2-digit" }) };
      for (const c of cities) {
        const v = filtered.find((r) => r.city === c && r.period === p)?.[k];
        if (v != null) row[c] = v;
      }
      return row;
    });
  const latest = data.filter((r) => r.period === latestPeriod);
  const first = (c: string) => filtered.filter((r) => r.city === c).sort((a, b) => a.period.localeCompare(b.period))[0];
  const avg = Math.round(latest.reduce((a, r) => a + (r.avg_asking_price_m2 ?? 0), 0) / Math.max(1, latest.length));
  const avgRent = Math.round(latest.reduce((a, r) => a + (r.avg_rent_m2 ?? 0), 0) / Math.max(1, latest.length));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Trh"
        sub={<span className="inline-flex items-center gap-2">Zdroj: <SampleBadge /> · připraveno pro napojení skutečných datových providerů</span>}
        actions={<div className="flex gap-0.5 rounded-md border p-0.5">{(Object.keys(RANGE) as R[]).map((r) => <button key={r} onClick={() => setRange(r)} className={cn("num rounded px-2.5 py-1 text-xs", r === range ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{r}</button>)}</div>}
      />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Kpi label="Prům. nabídková cena" value={`${formatCZK(avg)}/m²`} sub="napříč městy" />
        <Kpi label="Prům. nájem" value={`${formatCZK(avgRent)}/m²`} />
        <Kpi label="Hrubý výnos trhu" value={`${((avgRent * 12) / avg * 100).toFixed(2).replace(".", ",")} %`} sub="nájem×12 / cena" />
        <Kpi label="Sledovaná města" value={cities.length} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Trend cen (Kč/m²)"><MultiLine data={pivot("avg_asking_price_m2")} keys={cities} /></Section>
        <Section title="Trend nájmů (Kč/m²/měs.)"><MultiLine data={pivot("avg_rent_m2")} keys={cities} /></Section>
        <Section title="Regionální srovnání · cena/m²">
          <Bars data={[...latest].sort((a, b) => (b.avg_asking_price_m2 ?? 0) - (a.avg_asking_price_m2 ?? 0)).map((r) => ({ label: r.city, v: r.avg_asking_price_m2 ?? 0 }))} dataKey="v" height={300} />
        </Section>
        <Section title="Kvartální vývoj">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground"><tr><th className="py-1 font-medium">Město</th><th className="text-right font-medium">Kč/m²</th><th className="text-right font-medium">Změna</th><th className="text-right font-medium">Nájem</th><th className="text-right font-medium">Změna</th></tr></thead>
              <tbody>
                {latest.map((r) => {
                  const f = first(r.city);
                  const dp = f?.avg_asking_price_m2 && r.avg_asking_price_m2 ? ((r.avg_asking_price_m2 - f.avg_asking_price_m2) / f.avg_asking_price_m2) * 100 : null;
                  const dr = f?.avg_rent_m2 && r.avg_rent_m2 ? ((r.avg_rent_m2 - f.avg_rent_m2) / f.avg_rent_m2) * 100 : null;
                  const pct = (v: number | null) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1).replace(".", ",")} %`);
                  return (
                    <tr key={r.city} className="border-t border-border/50">
                      <td className="py-1.5">{r.city}</td>
                      <td className="num text-right">{formatCZK(r.avg_asking_price_m2)}</td>
                      <td className={cn("num text-right", (dp ?? 0) >= 0 ? "text-positive" : "text-negative")}>{pct(dp)}</td>
                      <td className="num text-right">{formatCZK(r.avg_rent_m2)}</td>
                      <td className={cn("num text-right", (dr ?? 0) >= 0 ? "text-positive" : "text-negative")}>{pct(dr)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Změna za zvolené období. Ukázková data pokrývají 3 kvartály – delší rozsahy zobrazí vše dostupné.</p>
        </Section>
      </div>
      <Section title="AI shrnutí trhu"><AiRunner kind="market" label="Shrnout trh" /></Section>
    </div>
  );
}
