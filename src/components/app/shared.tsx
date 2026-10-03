import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { formatCZK } from "@/lib/format";

export function SampleBadge({ className }: { className?: string }) {
  return (
    <span
      title="Ukázková data – nejde o živé tržní údaje"
      className={cn("inline-flex items-center rounded-sm border border-sample/50 bg-sample/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-sample", className)}
    >
      SAMPLE DATA
    </span>
  );
}

const freshTone: Record<string, string> = {
  FRESH: "text-positive border-positive/40 bg-positive/10",
  RECENT: "text-positive/80 border-positive/30 bg-positive/5",
  AGING: "text-warning border-warning/40 bg-warning/10",
  STALE: "text-negative border-negative/40 bg-negative/10",
  EXPIRED: "text-muted-foreground border-border",
  UNKNOWN: "text-muted-foreground border-border",
};
export function FreshnessBadge({ status }: { status: string }) {
  return <Badge variant="outline" className={cn("font-normal", freshTone[status])}>{t(`freshness.${status}`)}</Badge>;
}

const availTone: Record<string, string> = {
  ACTIVE_CONFIRMED: "text-positive border-positive/40",
  ACTIVE_UNCONFIRMED: "text-warning border-warning/40",
  RESERVED: "text-warning border-warning/40",
  SOLD: "text-negative border-negative/40",
  REMOVED: "text-negative border-negative/40",
  EXPIRED: "text-muted-foreground",
  UNKNOWN: "text-muted-foreground",
};
export function AvailabilityBadge({ status }: { status: string }) {
  return <Badge variant="outline" className={cn("font-normal", availTone[status])}>{t(`availability.${status}`)}</Badge>;
}

export function PriorityBadge({ value, size = "sm" }: { value: number; size?: "sm" | "lg" }) {
  const tone = value >= 60 ? "bg-positive/15 text-positive border-positive/40" : value >= 35 ? "bg-warning/15 text-warning border-warning/40" : "bg-muted text-muted-foreground border-border";
  return (
    <span title="Deal Priority (0–100)" className={cn("num inline-flex items-center justify-center rounded border font-semibold", tone, size === "lg" ? "h-12 min-w-12 px-2 text-xl" : "h-6 min-w-8 px-1.5 text-xs")}>
      {value}
    </span>
  );
}

export function Kpi({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "pos" | "neg" | undefined }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("num mt-1 text-lg font-semibold sm:text-xl", tone === "pos" && "text-positive", tone === "neg" && "text-negative")}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Section({ title, children, right, className }: { title: string; children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-md border bg-card", className)}>
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Delta({ value, pct }: { value: number | null; pct?: number | null }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const tone = value < 0 ? "text-negative" : value > 0 ? "text-positive" : "text-muted-foreground";
  return (
    <span className={cn("num", tone)}>
      {value > 0 ? "+" : ""}
      {formatCZK(value)}
      {pct != null && ` (${pct > 0 ? "+" : ""}${pct.toFixed(1).replace(".", ",")} %)`}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{children}</div>;
}

export function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/50 py-1.5 text-sm last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="num text-right">{v}</span>
    </div>
  );
}
