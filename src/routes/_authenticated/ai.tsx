import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listingsQuery } from "@/lib/queries";
import { pageHead } from "@/lib/head";
import { formatCZK } from "@/lib/format";
import { PageHeader, Section } from "@/components/app/shared";
import { AiRunner, type AiKind } from "@/components/app/AiPanel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/ai")({
  head: () => pageHead("Pomocník", "Srozumitelné vysvětlení nemovitostí, nabídek, nájmů a trhu."),
  loader: ({ context }) => context.queryClient.ensureQueryData(listingsQuery),
  component: AiPage,
});

const ACTIONS: Record<string, { kind: AiKind; label: string }[]> = {
  property: [
    { kind: "property", label: "Vysvětlit nemovitost" },
    { kind: "risks", label: "Najít rizika" },
    { kind: "due_diligence", label: "Co ověřit před koupí" },
  ],
  deal: [
    { kind: "deal", label: "Vysvětlit nabídku" },
    { kind: "risks", label: "Najít rizika" },
  ],
  portfolio: [{ kind: "portfolio", label: "Shrnutí mých nemovitostí" }],
  market: [{ kind: "market", label: "Shrnutí trhu" }],
};

function AiPage() {
  const { data } = useSuspenseQuery(listingsQuery);
  const [scope, setScope] = useState<keyof typeof ACTIONS>("property");
  const [listingId, setListingId] = useState(data[0]?.listing.id ?? "");
  const needsListing = scope === "property" || scope === "deal";
  return (
    <div className="space-y-4">
      <PageHeader
        title="Pomocník"
        sub="U vysvětlení rozlišujeme údaje ze zdrojů, odhady, předpoklady a to, co nevíme. Žádný odhad není zárukou."
      />
      <Tabs value={scope} onValueChange={(v) => setScope(v as keyof typeof ACTIONS)}>
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="property">Nemovitost</TabsTrigger>
          <TabsTrigger value="deal">Nabídka</TabsTrigger>
          <TabsTrigger value="portfolio">Moje nemovitosti</TabsTrigger>
          <TabsTrigger value="market">Trh</TabsTrigger>
        </TabsList>
      </Tabs>
      {needsListing && (
        <Select value={listingId} onValueChange={setListingId}>
          <SelectTrigger className="max-w-xl" aria-label="Nemovitost">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {data.map((e) => (
              <SelectItem key={e.listing.id} value={e.listing.id}>
                {e.listing.title} · {formatCZK(e.listing.price)} · hodnocení {e.priority}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <div className="grid gap-4">
        {ACTIONS[scope]!.map((a) => (
          <Section key={`${scope}-${a.kind}-${listingId}`} title={a.label}>
            <AiRunner
              kind={a.kind}
              listingId={needsListing ? listingId : undefined}
              label={a.label}
            />
          </Section>
        ))}
      </div>
    </div>
  );
}
