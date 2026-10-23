import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/head";
import { defaultInvestmentInput } from "@/lib/deals";
import { PageHeader } from "@/components/app/shared";
import { InvestmentCalculator } from "@/components/app/InvestmentCalculator";

export const Route = createFileRoute("/_authenticated/calculator")({
  head: () =>
    pageHead(
      "Kalkulačka",
      "Spočítejte splátku hypotéky, nájem po nákladech a možné zhodnocení peněz.",
    ),
  component: () => (
    <div>
      <PageHeader
        title="Investiční kalkulačka"
        sub="Částky jsou příkladem pro vlastní výpočet, ne skutečnou nabídkou. Zadejte své údaje. Odhad růstu ceny a nájmu není zaručený."
      />
      <InvestmentCalculator initial={defaultInvestmentInput(4_500_000, 16_000)} />
    </div>
  ),
});
