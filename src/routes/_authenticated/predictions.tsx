import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getPredictiveIntelligence } from "@/lib/prediction-engine.server";

export const Route = createFileRoute("/_authenticated/predictions")({
  component: PredictionsPage,
});

function pct(bps: number) {
  return `${(bps / 100).toFixed(1)} %`;
}
function money(v: number) {
  return new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(v);
}

function PredictionsPage() {
  const q = useQuery({
    queryKey: ["predictive-intelligence", "12"],
    queryFn: () => getPredictiveIntelligence({ data: { horizonMonths: 12, limit: 50 } }),
  });
  if (q.isPending) return <div className="p-6">Načítám predikční engine…</div>;
  if (q.isError) return <div className="p-6 text-destructive">Predikční engine: {q.error.message}</div>;
  const d = q.data;
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Prediction Intelligence</h1>
        <p className="text-sm text-muted-foreground">Pravděpodobnostní výhled trhu a pořadí nemovitostí. Není to věštění — každá predikce má nejistotu.</p>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border p-4"><div className="text-xs text-muted-foreground">Režim trhu</div><div className="mt-1 text-2xl font-bold">{d.market.regime}</div></div>
        <div className="rounded-xl border p-4"><div className="text-xs text-muted-foreground">Očekávaný růst 12M</div><div className="mt-1 text-2xl font-bold">{pct(d.market.expectedGrowthBps)}</div></div>
        <div className="rounded-xl border p-4"><div className="text-xs text-muted-foreground">P50 cena/m²</div><div className="mt-1 text-2xl font-bold">{money(d.market.priceDistribution.p50)} Kč</div></div>
        <div className="rounded-xl border p-4"><div className="text-xs text-muted-foreground">Jistota modelu</div><div className="mt-1 text-2xl font-bold">{Math.round(d.market.confidence * 100)} %</div></div>
      </section>

      <section className="rounded-xl border p-4">
        <h2 className="mb-3 font-semibold">Co model právě vidí</h2>
        <div className="space-y-2 text-sm">
          {d.market.drivers.map((x) => (
            <div key={x.factor} className="flex justify-between gap-4 border-b py-2 last:border-0">
              <span>{x.factor}</span><span className={x.direction === "up" ? "font-medium" : "font-medium"}>{x.contributionBps > 0 ? "+" : ""}{pct(x.contributionBps)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border">
        <div className="border-b p-4"><h2 className="font-semibold">Kandidáti ke koupi</h2><p className="text-xs text-muted-foreground">Investment Score = dnešní edge + budoucí edge + likvidita − riziko, vážené jistotou dat.</p></div>
        <div className="divide-y">
          {d.rankings.map((x, i) => (
            <div key={x.propertyId} className="grid gap-3 p-4 md:grid-cols-[48px_1fr_auto_auto] md:items-center">
              <div className="text-lg font-bold text-muted-foreground">#{i + 1}</div>
              <div>
                <div className="font-medium">{x.propertyId}</div>
                <div className="text-xs text-muted-foreground">{x.recommendation} · jistota {Math.round(x.confidence * 100)} %</div>
              </div>
              <div className="text-right"><div className="text-xs text-muted-foreground">Budoucí výnos</div><div className="font-semibold">{pct(x.expectedReturnBps)}</div></div>
              <div className="text-right"><div className="text-xs text-muted-foreground">Score</div><div className="text-xl font-bold">{x.investmentScore}/100</div></div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
