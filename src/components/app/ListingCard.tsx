import { Link } from "@tanstack/react-router";
import { Check, Minus } from "lucide-react";
import type { EnrichedListing } from "@/lib/deals";
import { formatBps, formatCZK, formatNumber } from "@/lib/format";
import { AvailabilityBadge, FreshnessBadge, PriorityBadge, SampleBadge } from "./shared";
import { cn } from "@/lib/utils";

export function ListingCard({ e, showReasons }: { e: EnrichedListing; showReasons?: boolean }) {
  const l = e.listing;
  return (
    <Link to="/properties/$id" params={{ id: l.id }} className="group block rounded-md border bg-card p-4 transition-colors hover:border-primary/50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">{e.isSample && <SampleBadge />}<span className="text-xs text-muted-foreground">{l.source_domain}</span></div>
          <h3 className="mt-1 truncate text-sm font-medium group-hover:text-primary">{l.title ?? "Bez názvu"}</h3>
          <p className="text-xs text-muted-foreground">{e.city ?? "—"}{l.rooms ? ` · ${l.rooms}` : ""}{l.area_m2 ? ` · ${formatNumber(Number(l.area_m2))} m²` : ""}</p>
        </div>
        <PriorityBadge value={e.priority} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <Stat k="Cena" v={formatCZK(l.price)} />
        <Stat k="Kč/m²" v={formatCZK(e.pricePerM2)} />
        <Stat k="Odhad" v={formatCZK(e.estimate?.estimatedValue)} />
        <Stat k="Rozdíl" v={e.diffBps == null ? "—" : `${e.diffBps > 0 ? "+" : ""}${formatBps(e.diffBps, 1)}`} tone={e.diffBps != null ? (e.diffBps < 0 ? "pos" : "neg") : undefined} />
        <Stat k="Nájem (odhad)" v={formatCZK(e.rent)} />
        <Stat k="Hrubý výnos" v={formatBps(e.grossYieldBps)} />
        <Stat k="Cash-flow" v={formatCZK(e.monthlyCashFlow)} tone={e.monthlyCashFlow != null ? (e.monthlyCashFlow >= 0 ? "pos" : "neg") : undefined} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <FreshnessBadge status={l.freshness_status} />
        <AvailabilityBadge status={l.availability_status} />
      </div>
      {showReasons && (
        <ul className="mt-3 space-y-1 border-t pt-3 text-xs">
          {e.reasons.map((r, i) => (
            <li key={i} className={cn("flex items-start gap-1.5", r.positive ? "text-positive" : "text-muted-foreground")}>
              {r.positive ? <Check className="mt-0.5 h-3 w-3 shrink-0" /> : <Minus className="mt-0.5 h-3 w-3 shrink-0 text-negative" />}
              {r.text}
            </li>
          ))}
        </ul>
      )}
    </Link>
  );
}

function Stat({ k, v, tone }: { k: string; v: string; tone?: "pos" | "neg" | undefined }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className={cn("num", tone === "pos" && "text-positive", tone === "neg" && "text-negative")}>{v}</div>
    </div>
  );
}
