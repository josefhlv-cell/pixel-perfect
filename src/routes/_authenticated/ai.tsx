import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listingsQuery } from "@/lib/queries";
import { pageHead } from "@/lib/head";
import { formatCZK } from "@/lib/format";
import { PageHeader, Section } from "@/components/app/shared";
import { AiRunner, type AiKind } from "@/components/app/AiPanel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/ai")({
  head: () => pageHead("AI Analytik", "AI analýza nemovitostí, dealů, portfolia a trhu."),
  loader: ({ context }) => context.queryClient.ensureQueryData(listingsQuery),
  component: AiPage,
});

const ACTIONS: Record<string, { kind: AiKind; label: string }[]> = {
  property: [{ kind: "property", label: "Analyzovat nemovitost" }, { kind: "risks", label: "Najít rizika" }, { kind: "due_diligence", label: "Připravit due diligence" }],
  deal: [{ kind: "deal", label: "Vysvětlit deal" }, { kind: "risks", label: "Najít rizika" }],
  portfolio: [{ kind: "portfolio", label: "Shrnutí portfolia" }],
  market: [{ kind: "market", label: "Shrnutí trhu" }],
};

function AiPage() {
  const { data } = useSuspenseQuery(listingsQuery);
  const [scope, setScope] = useState<keyof typeof ACTIONS>("property");
  const [listingId, setListingId] = useState(data[0]?.listing.id ?? "");
  const needsListing = scope === "property" || scope === "deal";
  return (
    <div className="space-y-4">
      <PageHeader title="AI Analytik" sub="Provider: Lovable AI. Finanční čísla počítá výpočetní jádro, AI je pouze interpretuje a označuje FACT / ESTIMATE / ASSUMPTION / UNKNOWN." />
      <Tabs value={scope} onValueChange={(v) => setScope(v as keyof typeof ACTIONS)}>
        <TabsList>
          <TabsTrigger value="property">Nemovitost</TabsTrigger>
          <TabsTrigger value="deal">Deal</TabsTrigger>
          <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
          <TabsTrigger value="market">Trh</TabsTrigger>
        </TabsList>
      </Tabs>
      {needsListing && (
        <Select value={listingId} onValueChange={setListingId}>
          <SelectTrigger className="max-w-xl" aria-label="Nemovitost"><SelectValue /></SelectTrigger>
          <SelectContent>
            {data.map((e) => <SelectItem key={e.listing.id} value={e.listing.id}>{e.listing.title} · {formatCZK(e.listing.price)} · DP {e.priority}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      <div className="grid gap-4">
        {ACTIONS[scope]!.map((a) => (
          <Section key={`${scope}-${a.kind}-${listingId}`} title={a.label}>
            <AiRunner kind={a.kind} listingId={needsListing ? listingId : undefined} label={a.label} />
          </Section>
        ))}
      </div>
    </div>
  );
}
