import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { runAiAnalysis } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import type { Claim, PropertyAnalysis } from "@/lib/ai/AIProvider";
import { cn } from "@/lib/utils";

export type AiKind = "property" | "deal" | "risks" | "due_diligence" | "portfolio" | "market";
type Result = Awaited<ReturnType<typeof runAiAnalysis>>;

const kindTone: Record<string, string> = {
  FACT: "border-positive/40 text-positive",
  ESTIMATE: "border-warning/40 text-warning",
  ASSUMPTION: "border-chart-3/40 text-chart-3",
  UNKNOWN: "border-border text-muted-foreground",
};

function Claims({ title, items }: { title: string; items: Claim[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      <ul className="space-y-1.5">
        {items.map((c, i) => (
          <li key={i} className="flex gap-2 text-sm">
            <span className={cn("mt-0.5 h-fit shrink-0 rounded-sm border px-1 font-mono text-[9px]", kindTone[c.kind])}>{c.kind}</span>
            <span>{c.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      <ul className="list-disc space-y-1 pl-5 text-sm">{items.map((s, i) => <li key={i}>{s}</li>)}</ul>
    </div>
  );
}

export function AnalysisView({ a, focus }: { a: PropertyAnalysis; focus?: AiKind }) {
  if (focus === "risks") return <div className="space-y-4"><Claims title="Rizika" items={a.risks} /><Claims title="Varovné signály" items={a.redFlags} /><List title="Chybějící informace" items={a.missingInfo} /></div>;
  if (focus === "due_diligence") return <div className="space-y-4"><List title="Due diligence" items={a.dueDiligence} /><List title="Otázky na prodávajícího" items={a.sellerQuestions} /><List title="Chybějící informace" items={a.missingInfo} /></div>;
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed">{a.summary}</p>
      <div className="grid gap-4 md:grid-cols-2">
        <Claims title="Výhody" items={a.advantages} />
        <Claims title="Rizika" items={a.risks} />
        <Claims title="Scénáře" items={a.scenarios} />
        <Claims title="Varovné signály" items={a.redFlags} />
        <List title="Chybějící informace" items={a.missingInfo} />
        <List title="Otázky na prodávajícího" items={a.sellerQuestions} />
      </div>
      <List title="Due diligence" items={a.dueDiligence} />
    </div>
  );
}

export function AiRunner({ kind, listingId, label }: { kind: AiKind; listingId?: string; label?: string }) {
  const run = useServerFn(runAiAnalysis);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  const go = async () => {
    setBusy(true);
    try {
      setRes(await run({ data: { kind, listingId } }));
    } catch {
      setRes({ ok: false, provider: "lovable", kind, error: "AI analýza je momentálně nedostupná. Výpočty a uložená data zůstávají dostupná." });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3">
      <Button onClick={go} disabled={busy} size="sm">
        <Sparkles className={cn("mr-1.5 h-4 w-4", busy && "animate-pulse")} />
        {busy ? "Analyzuji…" : label ?? "Analyzovat AI"}
      </Button>
      {res && !res.ok && <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">{res.error}</div>}
      {res?.ok && "analysis" in res && res.analysis && <AnalysisView a={res.analysis} focus={kind} />}
      {res?.ok && "text" in res && <p className="whitespace-pre-line text-sm leading-relaxed">{res.text}</p>}
      {res?.ok && <p className="text-[11px] text-muted-foreground">Provider: Lovable AI · Čísla pochází z výpočetního jádra, AI je nepřepočítává. Nejde o investiční poradenství.</p>}
    </div>
  );
}
