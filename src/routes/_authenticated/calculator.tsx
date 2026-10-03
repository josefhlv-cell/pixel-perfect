import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/head";
import { defaultInvestmentInput } from "@/lib/deals";
import { PageHeader } from "@/components/app/shared";
import { InvestmentCalculator } from "@/components/app/InvestmentCalculator";

export const Route = createFileRoute("/_authenticated/calculator")({
  head: () => pageHead("Kalkulačka", "Investiční kalkulačka: splátka, výnos, cash-flow, ROI, IRR a total return."),
  component: () => (
    <div>
      <PageHeader title="Investiční kalkulačka" sub="Výsledky se přepočítají okamžitě při změně vstupu. Výpočty používají centrální výpočetní jádro." />
      <InvestmentCalculator initial={defaultInvestmentInput(4_500_000, 16_000)} />
    </div>
  ),
});
