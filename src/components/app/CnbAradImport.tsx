import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { cnbAradStatus, importCnbArad } from "@/lib/cnb-arad.functions";
import { Button } from "@/components/ui/button";
import { Row } from "@/components/app/shared";

type Res = Awaited<ReturnType<typeof importCnbArad>>;

export function CnbAradImport() {
  const statusFn = useServerFn(cnbAradStatus);
  const importFn = useServerFn(importCnbArad);
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ["cnb-arad-status"], queryFn: () => statusFn() });
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Res | null>(null);

  const run = async () => {
    setBusy(true);
    try {
      const r = await importFn({ data: {} });
      setRes(r);
      const ins = r.results.reduce((s, x) => s + (x.ok ? x.inserted : 0), 0);
      toast.success(`ČNB: uloženo ${ins} nových hodnot`);
      qc.invalidateQueries({ queryKey: ["cnb-arad-status"] });
    } catch { toast.error("Import ČNB selhal."); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-2">
      <Row k="Uložených hodnot" v={status.data ? String(status.data.count) : "…"} />
      <Row k="Poslední stažení" v={status.data?.lastRetrievedAt ? new Date(status.data.lastRetrievedAt).toLocaleString("cs-CZ") : "—"} />
      <Button size="sm" onClick={run} disabled={busy}>{busy ? "Stahuji z ČNB…" : "Stáhnout data ČNB (ARAD)"}</Button>
      {res && (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {res.results.map((x) => (
            <li key={x.setId}>
              Sada {x.setId}: {x.ok ? `staženo ${x.fetched}, nových ${x.inserted} (z toho revizí ${x.revised}), přeskočeno ${x.skipped}` : x.error}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">Data se jen přidávají, nikdy nepřepisují. Datum zveřejnění ČNB neuvádí, proto platí čas stažení.</p>
    </div>
  );
}
