import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { getCzechHousePriceForecast } from "@/lib/house-price.functions";
import { Kpi, Section } from "@/components/app/shared";
import { cn } from "@/lib/utils";

const CLAIM: Record<string, string> = {
  NO_EDGE: "Lepší přesnost zatím nebyla prokázána",
  EDGE: "Přesnější než jednoduchý srovnávací odhad",
  INSUFFICIENT_SAMPLE: "Příliš málo období pro ověření přesnosti",
};

const MODEL: Record<string, string> = {
  PERSIST: "pokračování poslední změny",
  ZERO: "beze změny cen",
  MEAN: "historický průměr",
  LOCAL: "průměr posledních 8 období",
  DAMPED: "pokračování s poloviční změnou",
  AR1: "návaznost na předchozí období",
  RATE_LAG: "vliv úroku a předchozí změny cen",
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
  return `${quarter}. čtvrtletí ${date.getUTCFullYear()}`;
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
      title="Česko · odhad změny cen bytů za rok"
      right={
        compact ? (
          <Link to="/market" className="text-xs text-primary hover:underline">
            Podrobnosti odhadu →
          </Link>
        ) : (
          <span className="text-[10px] text-muted-foreground">Zdroj: evropský statistický úřad Eurostat</span>
        )
      }
    >
      {query.isPending && (
        <p className="text-sm text-muted-foreground">Ověřuji odhad na dostupných historických údajích…</p>
      )}
      {query.isError && (
        <p className="text-sm text-negative">Odhad se teď nepodařilo vypočítat.</p>
      )}
      {data && !data.ok && <p className="text-sm text-negative">{data.error}</p>}
      {data?.ok && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider",
                data.claim === "EDGE"
                  ? "border-positive/40 text-positive"
                  : "border-warning/40 text-warning",
              )}
            >
              {CLAIM[data.claim] ?? "Přesnost zatím není ověřena"}
            </span>
            <span className="text-xs text-muted-foreground">
              Použitý výpočet: {MODEL[data.issuedModel] ?? "jiný výpočet"}
              {data.champion
                ? ` · nejlépe ověřený: ${MODEL[data.champion] ?? "jiný výpočet"}`
                : " · žádný výpočet zatím nemá prokázanou převahu"}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Kpi label="Nižší odhad" value={pricePct(data.percent?.p10)} sub="Pod touto změnou leží 10 % odhadovaných výsledků" />
            <Kpi
              label="Střední odhad"
              value={pricePct(data.percent?.p50)}
              sub={`${quarterLabel(data.originPeriod)} → ${quarterLabel(data.horizonPeriod)}`}
            />
            <Kpi label="Vyšší odhad" value={pricePct(data.percent?.p90)} sub="Pod touto změnou leží 90 % odhadovaných výsledků" />
          </div>
          <p className="text-xs text-muted-foreground">
            Procenta vyjadřují možnou změnu cen za rok. Záporná hodnota znamená pokles.
            Rozmezí není záruka; skutečný výsledek může ležet i mimo něj.
            Celostátní odhad neurčuje cenu konkrétního bytu.
          </p>
          {!compact && (
            <>
              <p className="text-xs text-muted-foreground">
                Ověřeno na {data.scoredOrigins} historických obdobích. Odhadovaná pravděpodobnost růstu cen:{" "}
                {data.probabilityPositive == null
                  ? "—"
                  : `${Math.round(data.probabilityPositive * 100)} %`}
                . Aktuální odhad se zatím neukládá do historie. Nejde o doporučení ke koupi.
              </p>
              {data.comparisons.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="py-1 font-medium">Způsob výpočtu</th>
                        <th className="text-right font-medium">Průměrná chyba</th>
                        <th className="text-right font-medium">Chyba srovnávacího odhadu</th>
                        <th className="text-right font-medium">Zlepšení chyby</th>
                        <th className="text-right font-medium">Nejistota zlepšení</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.comparisons.map((row) => (
                        <tr key={row.modelId} className="border-t border-border/50">
                          <td className="py-1.5">{MODEL[row.modelId] ?? "Jiný výpočet"}</td>
                          <td className="num text-right">{logPoints(row.mae)}</td>
                          <td className="num text-right">{logPoints(row.benchmarkMae)}</td>
                          <td
                            className={cn(
                              "num text-right",
                              row.significant && row.improvement > 0
                                ? "text-positive"
                                : "text-muted-foreground",
                            )}
                          >
                            {logPoints(row.improvement)}
                            {row.significant ? "" : " (neprůkazné)"}
                          </td>
                          <td className="num text-right text-muted-foreground">
                            {logPoints(row.confidenceLow)} … {logPoints(row.confidenceHigh)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Menší chyba znamená přesnější odhad v minulosti. Srovnávací odhad předpokládá pokračování poslední změny.
                Chyby jsou ve společné výpočetní stupnici, nikoli v korunách nebo procentech ceny.
                Rozmezí nejistoty zlepšení má úroveň 95 %; pokud zahrnuje nulu, lepší přesnost není prokázaná.
              </p>
              {data.journal.length > 0 && (
                <div>
                  <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                    Dřívější zaznamenané odhady
                  </div>
                  <ul className="divide-y text-sm">
                    {data.journal.map((row) => (
                      <li
                        key={row.contractHash}
                        className="flex flex-wrap items-baseline justify-between gap-2 py-1.5"
                      >
                        <span className="font-mono text-xs">{row.contractHash.slice(0, 12)}</span>
                        <span className="text-muted-foreground">
                          {MODEL[row.model] ?? "Jiný výpočet"} ·{" "}
                          {CLAIM[row.claim ?? ""] ?? "Přesnost zatím není ověřena"}
                        </span>
                        <span className="num">
                          {row.realized == null
                            ? "čeká na skutečný výsledek"
                            : row.insideInterval
                              ? "skutečnost v odhadovaném rozmezí"
                              : "skutečnost mimo odhadované rozmezí"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
          {compact && (
            <p className="text-xs text-muted-foreground">
              Přesnost na minulých údajích nezaručuje budoucí výsledek. Nejde o doporučení ke koupi.
            </p>
          )}
        </div>
      )}
    </Section>
  );
}
