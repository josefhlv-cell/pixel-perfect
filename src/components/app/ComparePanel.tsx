import { X } from "lucide-react";
import type { EnrichedListing } from "@/lib/deals";
import { formatBps, formatCZK, formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { PriorityBadge } from "./shared";
import { Link } from "@tanstack/react-router";

export function ComparePanel({
  items,
  onClose,
  onRemove,
}: {
  items: EnrichedListing[];
  onClose: () => void;
  onRemove: (id: string) => void;
}) {
  if (items.length < 2) return null;

  const rows: { label: string; get: (e: EnrichedListing) => string }[] = [
    { label: "Cena", get: (e) => formatCZK(e.listing.price) },
    { label: "Kč/m²", get: (e) => formatCZK(e.pricePerM2) },
    { label: "Plocha", get: (e) => (e.listing.area_m2 != null ? `${formatNumber(Number(e.listing.area_m2))} m²` : "—") },
    { label: "Dispozice", get: (e) => e.listing.rooms ?? "—" },
    { label: "Město", get: (e) => e.city ?? "—" },
    { label: "Odhad hodnoty", get: (e) => formatCZK(e.estimate?.estimatedValue) },
    { label: "Rozdíl vs. odhad", get: (e) => (e.diffBps == null ? "—" : formatBps(e.diffBps, 1)) },
    { label: "Hrubý výnos", get: (e) => formatBps(e.grossYieldBps) },
    { label: "Cash-flow / měs.", get: (e) => formatCZK(e.monthlyCashFlow) },
    { label: "Deal Priority", get: (e) => String(e.priority) },
    { label: "Čerstvost", get: (e) => e.listing.freshness_status },
    { label: "Dostupnost", get: (e) => e.listing.availability_status },
  ];

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 p-4 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto max-w-6xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Porovnání ({items.length})</h3>
          <Button size="sm" variant="ghost" onClick={onClose} aria-label="Zavřít">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-3 font-normal">Metrika</th>
                {items.map((e) => (
                  <th key={e.listing.id} className="pb-2 pr-3 font-normal">
                    <div className="flex items-start justify-between gap-1">
                      <Link to="/properties/$id" params={{ id: e.listing.id }} className="line-clamp-2 hover:text-primary">
                        {e.listing.title ?? "Bez názvu"}
                      </Link>
                      <button type="button" className="shrink-0 text-muted-foreground hover:text-foreground" onClick={() => onRemove(e.listing.id)} aria-label="Odebrat">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-1"><PriorityBadge value={e.priority} /></div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-t border-border/50">
                  <td className="py-1.5 pr-3 text-xs text-muted-foreground">{row.label}</td>
                  {items.map((e) => (
                    <td key={e.listing.id} className="num py-1.5 pr-3">{row.get(e)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
