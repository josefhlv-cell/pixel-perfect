/**
 * AI server functions. Uses the existing AIProvider abstraction (Lovable AI by default).
 * Financial metrics are computed server-side by the calculation engine and passed in
 * as authoritative data; the model never recomputes them. Listing text is untrusted.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculateTotalReturn } from "./calculations";
import { defaultInvestmentInput, enrichListing, latestStatsByCity } from "./deals";
import { portfolioTotals } from "./portfolio";

const input = z.object({
  kind: z.enum(["property", "deal", "risks", "due_diligence", "portfolio", "market"]),
  listingId: z.string().uuid().optional(),
});

export const runAiAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { getAIProvider } = await import("./ai/index.server");
    const { AIUnavailableError } = await import("./ai/AIProvider");
    const ai = getAIProvider();
    let propertyId: string | null = null;

    const logUsage = async (result: unknown) => {
      const usage = (ai as { lastUsage?: { tokensInput: number | null; tokensOutput: number | null } }).lastUsage;
      await supabase.from("ai_usage").insert({
        user_id: userId,
        provider: ai.name,
        model: ai.model,
        tokens_input: usage?.tokensInput ?? null,
        tokens_output: usage?.tokensOutput ?? null,
        tool_calls: 0,
      });
      await supabase.from("ai_analyses").insert({ user_id: userId, property_id: propertyId, kind: data.kind, provider: ai.name, model: ai.model, result: result as never });
    };

    try {
      if (data.kind === "market") {
        const { data: stats } = await supabase.from("market_statistics").select("city,period,avg_asking_price_m2,avg_rent_m2,listings_count,is_sample").order("period");
        const r = await ai.summarizeMarket({ stats: (stats ?? []) as Record<string, unknown>[] });
        await logUsage(r);
        return { ok: true as const, provider: ai.name, kind: data.kind, text: r.insight };
      }
      if (data.kind === "portfolio") {
        const [p, v] = await Promise.all([
          supabase.from("portfolio_properties").select("*").eq("user_id", userId),
          supabase.from("portfolio_valuations").select("*").eq("user_id", userId),
        ]);
        const totals = portfolioTotals(p.data ?? [], v.data ?? []);
        const r = await ai.explainDeal({
          property: { typ: "portfolio", nemovitosti: (p.data ?? []).map((x) => ({ name: x.name, city: x.city, area_m2: x.area_m2 })) },
          metrics: { ...totals, poznamka: "Hodnoty v Kč, výnos v bps. Vypočteno výpočetním jádrem." },
          listingText: null,
        });
        await logUsage(r);
        return { ok: true as const, provider: ai.name, kind: data.kind, text: r.explanation };
      }

      if (!data.listingId) throw new Error("Chybí nemovitost");
      const { data: l } = await supabase.from("listings").select("*").eq("id", data.listingId).single();
      if (!l) throw new Error("Nemovitost nenalezena");
      propertyId = l.property_id;
      const [{ data: prop }, { data: stats }, { data: snaps }] = await Promise.all([
        supabase.from("properties").select("*").eq("id", l.property_id).maybeSingle(),
        supabase.from("market_statistics").select("*"),
        supabase.from("listing_snapshots").select("*").eq("listing_id", l.id),
      ]);
      const e = enrichListing(l, prop ?? null, latestStatsByCity(stats ?? []), snaps ?? []);
      const calc = l.price && e.rent ? calculateTotalReturn(defaultInvestmentInput(l.price, e.rent)) : null;
      const property = {
        title: l.title, city: e.city, address: l.address, price_czk: l.price, area_m2: l.area_m2, rooms: l.rooms,
        type: l.property_type, condition: prop?.condition, energy_class: prop?.energy_class, floor: prop?.floor,
        availability: l.availability_status, freshness: l.freshness_status, source: l.source_domain, is_sample: e.isSample,
      };
      const metrics = {
        price_per_m2: e.pricePerM2, estimated_value: e.estimate?.estimatedValue ?? null, estimate_confidence: e.estimate?.confidence ?? null,
        diff_vs_estimate_bps: e.diffBps, estimated_rent: e.rent, gross_yield_bps: e.grossYieldBps, deal_priority: e.priority,
        ...(calc && { monthly_mortgage: calc.monthlyMortgage, monthly_cash_flow: calc.monthlyCashFlow, net_yield_bps: calc.netYieldBps, cash_on_cash_bps: calc.cashOnCashBps, irr_bps: calc.irrBps, roi_bps: calc.roiBps, ltv_bps: calc.ltvBps }),
        assumptions: "LTV 80 %, úrok 4,89 %, 30 let, neobsazenost 5 %, náklady 15 % nájmu",
      };
      const listingText = prop?.description ?? null;
      if (data.kind === "deal") {
        const r = await ai.explainDeal({ property, metrics, listingText });
        await logUsage(r);
        return { ok: true as const, provider: ai.name, kind: data.kind, text: r.explanation };
      }
      const r = await ai.analyzeProperty({ property, metrics, listingText });
      await logUsage(r);
      return { ok: true as const, provider: ai.name, kind: data.kind, analysis: r };
    } catch (err) {
      if (err instanceof AIUnavailableError) {
        return { ok: false as const, provider: ai.name, kind: data.kind, error: "AI analýza je momentálně nedostupná. Výpočty a uložená data zůstávají dostupná." };
      }
      console.error("[ai] analysis failed", err);
      return { ok: false as const, provider: ai.name, kind: data.kind, error: "Něco se nepovedlo. Zkuste to prosím znovu." };
    }
  });
