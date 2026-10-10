import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { getCzechHousePriceForecast } from "@/lib/house-price.functions";
import { Kpi, Section } from "@/components/app/shared";
import { cn } from "@/lib/utils";

const CLAIM: Record<string, string> = {
  NO_EDGE: "Bez prokázané výhody",
  EDGE: "Výhoda proti persistenci",
  INSUFFICIENT_SAMPLE: "Málo historických oken",
};

const MODEL: Record<string, string> = {
  PERSIST: "persistence",
  ZERO: "nula",
  AR1: "AR(1)",
  RATE_LAG: "sazba + minulý výnos",
};

function logPoints(value: number): string {
  return value.toLocaleString("cs-CZ", { maximumFractionDigits: 3, signDisplay: "exceptZero" });
}

function pricePct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString("cs-CZ", { maximumFractionDigits: 1, signDisplay: "exceptZero" })} %`;
}

function quarterLabel(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
  return `${date.getUTCFullYear()} Q${quarter}`;
}

export function HousePriceForecast({ compact = false }: { compact?: boolean }) {
  const load = useServerFn(getCzechHousePriceForecast);
  const query = useQuery({
    queryKey: ["cz-hpi-forecast"],
    queryFn: () => load(),
    staleTime: 30 * 60 * 1000,
  });
  const data = query.data;

  return (
    <Section
      title="Česko · index cen bytů, další rok"
      right={compact ? <Link to="/market" className="text-xs text-primary hover:underline">Celý kontrakt →</Link> : <span className="font-mono text-[10px] text-muted-foreground">Eurostat prc_hpi_q</span>}
    >
      {query.isPending && <p className="text-sm text-muted-foreground">Počítám walk-forward na zveřejněné řadě…</p>}
      {query.isError && <p className="text-sm text-negative">Forecast se teď nepodařilo spočítat.</p>}
      {data && !data.ok && <p className="text-sm text-negative">{data.error}</p>}
      {data?.ok && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn(
              "rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider",
              data.claim === "EDGE" ? "border-positive/40 text-positive" : "border-warning/40 text-warning",
            )}>
              {CLAIM[data.claim] ?? data.claim}
            </span>
            <span className="text-xs text-muted-foreground">
              vydaný model: {MODEL[data.issuedModel] ?? data.issuedModel}
              {data.champion ? ` · šampion: ${MODEL[data.champion] ?? data.champion}` : " · šampion walk-forwardu není"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Kpi label="P10" value={pricePct(data.percent?.p10)} sub="spodní okraj" />
            <Kpi label="P50" value={pricePct(data.percent?.p50)} sub={`${quarterLabel(data.originPeriod)} → ${quarterLabel(data.horizonPeriod)}`} />
            <Kpi label="P90" value={pricePct(data.percent?.p90)} sub="horní okraj" />
          </div>
          {!compact && (
            <>
              <p className="text-sm text-muted-foreground">{data.caveat}</p>
              <p className="text-xs text-muted-foreground">
                Okna out-of-sample: {data.scoredOrigins}. Pravděpodobnost kladného výnosu u vydaného modelu: {data.probabilityPositive == null ? "—" : `${Math.round(data.probabilityPositive * 100)} %`}.
                {" "}Kontrakt <span className="font-mono">{data.contractHash.slice(0, 12)}</span>.
                {" "}{data.persisted ? "Zapsáno do journalu." : "Journal se nepodařilo zapsat, kontrakt platí jen pro tohle zobrazení."}
                {data.promotable ? "" : " Není povýžitelný a není to pokyn k nákupu."}
              </p>
              {data.comparisons.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="py-1 font-medium">Model</th>
                        <th className="text-right font-medium">MAE</th>
                        <th className="text-right font-medium">Persistence</th>
                        <th className="text-right font-medium">Δ MAE</th>
                        <th className="text-right font-medium">95 %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.comparisons.map((row) => (
                        <tr key={row.modelId} className="border-t border-border/50">
                          <td className="py-1.5">{MODEL[row.modelId] ?? row.modelId}</td>
                          <td className="num text-right">{logPoints(row.mae)}</td>
                          <td className="num text-right">{logPoints(row.benchmarkMae)}</td>
                          <td className={cn("num text-right", row.significant && row.improvement > 0 ? "text-positive" : "text-muted-foreground")}>
                            {logPoints(row.improvement)}{row.significant ? "" : " n.s."}
                          </td>
                          <td className="num text-right text-muted-foreground">{logPoints(row.confidenceLow)} … {logPoints(row.confidenceHigh)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {data.journal.length > 0 && (
                <div>
                  <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Zapečetěné kontrakty</div>
                  <ul className="divide-y text-sm">
                    {data.journal.map((row) => (
                      <li key={row.contractHash} className="flex flex-wrap items-baseline justify-between gap-2 py-1.5">
                        <span className="font-mono text-xs">{row.contractHash.slice(0, 12)}</span>
                        <span className="text-muted-foreground">{MODEL[row.model] ?? row.model} · {CLAIM[row.claim ?? ""] ?? row.claim ?? "—"}</span>
                        <span className="num">{row.realized == null ? "čeká na realizaci" : (row.insideInterval ? "realizace v intervalu" : "realizace mimo interval")}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
          {compact && (
            <p className="text-xs text-muted-foreground">
              {data.caveat} {data.promotable ? "" : "Není to pokyn k nákupu."}
            </p>
          )}
        </div>
      )}
    </Section>
  );
}
