import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getPredictiveIntelligence } from "@/lib/prediction-engine.server";

export const Route = createFileRoute("/_authenticated/predictions")({ component: PredictionsPage });

function pct(bps:number){ return `${(bps/100).toFixed(1)} %`; }
function money(v:number){ return new Intl.NumberFormat("cs-CZ",{maximumFractionDigits:0}).format(v); }

function PredictionsPage(){
  const q=useQuery({
    queryKey:["predictive-intelligence","12"],
    queryFn:()=>getPredictiveIntelligence({data:{horizonMonths:12,limit:50}})
  });
  if(q.isPending)return <div className="p-6">Načítám predikční engine…</div>;
  if(q.isError)return <div className="p-6 text-destructive">Predikční engine: {q.error.message}</div>;
  const d=q.data;

  return <div className="space-y-6 p-6">
    <header>
      <h1 className="text-2xl font-semibold">Prediction Intelligence</h1>
      <p className="text-sm text-muted-foreground">Pravděpodobnostní výhled, scénáře a kauzální řetězec. Model nezná budoucnost — průběžně měří, kdy se jeho předpoklady rozpadají.</p>
    </header>

    <section className="grid gap-4 md:grid-cols-4">
      {[
        ["Režim trhu",d.market.regime],
        ["Očekávaný růst 12M",pct(d.market.expectedGrowthBps)],
        ["P50 cena/m²",`${money(d.market.priceDistribution.p50)} Kč`],
        ["Jistota modelu",`${Math.round(d.market.confidence*100)} %`]
      ].map(([label,value])=><div key={label} className="rounded-xl border p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-bold">{value}</div></div>)}
    </section>

    <section className="rounded-xl border p-4">
      <div className="mb-3"><h2 className="font-semibold">Kde se trh právě nachází</h2><p className="text-xs text-muted-foreground">Kauzální mapa sleduje cestu financování → dostupnost → poptávka → nabídka → likvidita → cena.</p></div>
      <div className="flex flex-wrap gap-2">
        {["FINANCING","DEMAND","SUPPLY","LIQUIDITY","PRICE_DISCOVERY","BALANCED"].map(x=><span key={x} className={x===d.causal.phase?"rounded-full border px-3 py-1 text-sm font-semibold":"rounded-full border px-3 py-1 text-sm text-muted-foreground"}>{x}</span>)}
      </div>
    </section>

    <section className="grid gap-4 lg:grid-cols-4">
      {d.scenarios.map(s=><div key={s.scenario} className="rounded-xl border p-4">
        <div className="flex justify-between"><span className="font-semibold">{s.scenario}</span><span className="text-sm text-muted-foreground">{Math.round(s.probability*100)} %</span></div>
        <div className="mt-2 text-xl font-bold">{pct(s.annualGrowthBps)}</div>
        <div className="text-sm text-muted-foreground">cílová cena/m² {money(s.priceM2)} Kč</div>
        <ul className="mt-3 space-y-1 text-xs">{s.assumptions.map(a=><li key={a}>• {a}</li>)}</ul>
      </div>)}
    </section>

    <section className="rounded-xl border p-4">
      <h2 className="mb-3 font-semibold">Co by změnilo výsledek</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {d.causal.scenarios.map((s,i)=><div key={i} className="rounded-lg bg-muted/40 p-3">
          <div className="font-medium">{Object.entries(s.intervention).map(([k,v])=>`${k}: ${v}`).join(" · ")}</div>
          <div className="mt-1 text-sm">Cena: {pct(s.priceImpactBps)} · transakce: {pct(s.transactionImpactBps)} · likvidita: {pct(s.liquidityImpactBps)}</div>
          <div className="mt-1 text-xs text-muted-foreground">Dominantní cesta: {s.dominantPath.join(" → ")}</div>
        </div>)}
      </div>
    </section>

    <section className="rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">World Model — robustnost budoucnosti</h2><p className="text-xs text-muted-foreground">10 000 reprodukovatelných strukturálních scénářů. Pravděpodobnosti nejsou empiricky kalibrované, dokud neproběhne historický OOS replay.</p></div><div className="rounded-full border px-3 py-1 text-xs font-semibold">{d.worldModel.robustAction}</div></div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">{[["P10",pct(d.worldModel.quantiles.p10*10000)],["P50",pct(d.worldModel.quantiles.p50*10000)],["P90",pct(d.worldModel.quantiles.p90*10000)],["P(zisk)",`${Math.round(d.worldModel.probabilityPositive*100)} %`]].map(([label,value])=><div key={label} className="rounded-lg bg-muted/40 p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="text-xl font-bold">{value}</div></div>)}</div>
      <div className="mt-3 grid gap-3 md:grid-cols-3 text-sm"><div>CVaR10: <b>{pct(d.worldModel.cvar10*10000)}</b></div><div>Survival: <b>{Math.round(d.worldModel.survivalProbability*100)} %</b></div><div>Stav: <b>{d.worldModel.calibrationStatus}</b></div></div>
    </section>

    <section className="rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">Radar změny režimu</h2><p className="text-xs text-muted-foreground">Sleduje, zda se mění samotná dynamika trhu, ne jen jeho úroveň.</p></div><div className="rounded-full border px-3 py-1 text-xs font-semibold">{d.regimeChange.severity}</div></div>
      <div className="mt-3 text-sm">Skóre změny: <b>{Math.round(d.regimeChange.score*100)} %</b></div>
      <div className="mt-2 flex flex-wrap gap-2">{d.regimeChange.signals.map(s=><span key={s} className="rounded-full bg-muted px-2 py-1 text-xs">{s}</span>)}</div>
    </section>

    <section className="rounded-xl border p-4">
      <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">Evidence Conflict</h2><p className="text-xs text-muted-foreground">Když si zdroje odporují nebo jsou zastaralé, systém to ukáže.</p></div><div className="rounded-full border px-3 py-1 text-xs font-semibold">{d.evidenceConflict.action}</div></div>
      <div className="mt-3 grid gap-3 md:grid-cols-3 text-sm"><div>Konflikt: <b>{Math.round(d.evidenceConflict.conflictScore*100)} %</b></div><div>Rozptyl: <b>{(d.evidenceConflict.dispersion*100).toFixed(1)} %</b></div><div>Zastaralá data: <b>{Math.round(d.evidenceConflict.staleShare*100)} %</b></div></div>
    </section>

        <section className="rounded-xl border p-4">
      <h2 className="mb-3 font-semibold">Co model právě vidí</h2>
      <div className="space-y-2 text-sm">{d.market.drivers.map(x=><div key={x.factor} className="flex justify-between gap-4 border-b py-2 last:border-0"><span>{x.factor}</span><span className="font-medium">{x.contributionBps>0?"+":""}{pct(x.contributionBps)}</span></div>)}</div>
    </section>

    <section className="rounded-xl border">
      <div className="border-b p-4"><h2 className="font-semibold">Kandidáti ke koupi</h2><p className="text-xs text-muted-foreground">Score odděluje dnešní edge, budoucí edge, likviditu a riziko; nízká kvalita dat snižuje skóre.</p></div>
      <div className="divide-y">{d.rankings.map((x,i)=><div key={x.propertyId} className="grid gap-3 p-4 md:grid-cols-[48px_1fr_auto_auto] md:items-center">
        <div className="text-lg font-bold text-muted-foreground">#{i+1}</div>
        <div><div className="font-medium">{x.propertyId}</div><div className="text-xs text-muted-foreground">{x.recommendation} · jistota {Math.round(x.confidence*100)} % · riziko {x.riskScore}/100</div></div>
        <div className="text-right"><div className="text-xs text-muted-foreground">Budoucí výnos</div><div className="font-semibold">{pct(x.expectedReturnBps)}</div></div>
        <div className="text-right"><div className="text-xs text-muted-foreground">Score</div><div className="text-xl font-bold">{x.investmentScore}/100</div></div>
      </div>)}</div>
    </section>

    <footer className="rounded-xl border bg-muted/20 p-4 text-xs text-muted-foreground">
      Model {d.modelVersion} · lineage {d.lineage.reproducibilityKey} · {d.lineage.dataSources.map(s=>s.source).join(", ")}. Strukturální scénáře nejsou tvrzení o skutečné kauzalitě; predikce jsou nejisté a musí být validovány proti budoucím transakcím.
    </footer>
  </div>;
}
