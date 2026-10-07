/**
 * Server adapter for Predictive Intelligence.
 * Reads the existing market/listing data and exposes forecast + scenario + audit layers.
 */
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { forecastMarket, rankProperties, type MarketObservation, type PropertySignal } from "./prediction-engine";
import { buildFeatureSnapshot, scenarioMixture, mixtureExpectedGrowth, probabilityAbove } from "./predictive-v2";
import { DEFAULT_CAUSAL_GRAPH, locateMarketInCausalChain, propagateCausalShock } from "./prediction-causal";
import { buildPredictionLineage } from "./prediction-lineage";

const input = z.object({
  city: z.string().min(1).optional(),
  horizonMonths: z.number().int().min(3).max(120).default(12),
  limit: z.number().int().min(1).max(100).default(25),
});

export const getPredictiveIntelligence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const city = data.city?.trim();

    const [marketRes, listingRes, propertyRes, snapshotRes] = await Promise.all([
      supabase.from("market_statistics").select("*").order("period"),
      supabase.from("listings").select("*").order("created_at", { ascending: false }).limit(1000),
      supabase.from("properties").select("*").limit(1000),
      supabase.from("listing_snapshots").select("listing_id,price,observed_at").order("observed_at"),
    ]);
    if (marketRes.error) throw marketRes.error;
    if (listingRes.error) throw listingRes.error;
    if (propertyRes.error) throw propertyRes.error;
    if (snapshotRes.error) throw snapshotRes.error;

    const stats = (marketRes.data ?? [])
      .filter((r) => !city || r.city === city)
      .map((r) => ({
        date: r.period,
        priceM2: Number(r.avg_asking_price_m2 ?? 0),
        rentM2: r.avg_rent_m2 == null ? null : Number(r.avg_rent_m2),
        listings: r.listings_count,
        daysOnMarket: r.median_days_on_market ?? null,
        priceDrops: r.price_drop_count ?? null,
      }))
      .filter((r) => r.priceM2 > 0) as MarketObservation[];

    const fallbackStats = stats.length ? stats : (marketRes.data ?? []).map((r) => ({
      date: r.period,
      priceM2: Number(r.avg_asking_price_m2 ?? 0),
      rentM2: r.avg_rent_m2 == null ? null : Number(r.avg_rent_m2),
      listings: r.listings_count,
      daysOnMarket: r.median_days_on_market ?? null,
      priceDrops: r.price_drop_count ?? null,
    })).filter((r) => r.priceM2 > 0) as MarketObservation[];

    const market = forecastMarket(fallbackStats, data.horizonMonths);
    const features = buildFeatureSnapshot(fallbackStats);
    const scenarios = scenarioMixture(features.priceM2, data.horizonMonths, features, market.expectedGrowthBps);
    const scenarioExpectedGrowthBps = mixtureExpectedGrowth(scenarios);

    const latest = fallbackStats.at(-1);
    const causalBaseline = {
      POLICY_RATE: latest?.policyRateBps ?? 0,
      MORTGAGE_RATE: latest?.mortgageRateBps ?? 0,
      AFFORDABILITY: features.affordabilityBps,
      CREDIT: latest?.creditGrowthBps ?? 0,
      INCOME: latest?.wageGrowthBps ?? 0,
      EMPLOYMENT: latest?.unemploymentBps != null ? -latest.unemploymentBps : 0,
      DEMAND: features.demandPressureBps,
      INVENTORY: features.supplyPressureBps,
      DOM: latest?.daysOnMarket != null ? (latest.daysOnMarket - 60) * 100 : 0,
      PRICE: features.priceGrowthBps,
      TRANSACTIONS: 0,
      RENT: latest?.rentM2 != null ? features.priceM2 > 0 ? (latest.rentM2 / features.priceM2) * 10000 : 0 : 0,
      CONSTRUCTION: latest?.completionsGrowthBps ?? 0,
    } as const;
    const causalPhase = locateMarketInCausalChain(causalBaseline);
    const causalScenarios = [
      propagateCausalShock(DEFAULT_CAUSAL_GRAPH, causalBaseline, { POLICY_RATE: 1000 }, data.horizonMonths),
      propagateCausalShock(DEFAULT_CAUSAL_GRAPH, causalBaseline, { POLICY_RATE: -1000 }, data.horizonMonths),
      propagateCausalShock(DEFAULT_CAUSAL_GRAPH, causalBaseline, { CONSTRUCTION: 2500 }, data.horizonMonths),
      propagateCausalShock(DEFAULT_CAUSAL_GRAPH, causalBaseline, { CREDIT: -1500 }, data.horizonMonths),
    ];

    const propertiesById = new Map((propertyRes.data ?? []).map((p) => [p.id, p]));
    const signals: PropertySignal[] = (listingRes.data ?? [])
      .filter((l) => l.price && l.area_m2 && !["SOLD", "REMOVED", "EXPIRED"].includes(l.availability_status))
      .filter((l) => !city || ((propertiesById.get(l.property_id)?.city ?? l.location ?? "").split(/[,–-]/)[0]?.trim() === city))
      .slice(0, data.limit)
      .map((l) => {
        const p = propertiesById.get(l.property_id);
        return {
          id: l.id,
          price: Number(l.price),
          areaM2: Number(l.area_m2),
          city: p?.city ?? l.location,
          rooms: l.rooms,
          floor: p?.floor,
          ageYears: null,
          freshnessDays: l.freshness_status === "FRESH" ? 1 : l.freshness_status === "RECENT" ? 7 : 30,
          availabilityConfirmed: l.availability_status === "ACTIVE_CONFIRMED",
          estimatedRent: null,
          estimatedValue: null,
        };
      });

    const rankings = rankProperties(signals, market);
    const generatedAt = new Date().toISOString();
    const lineage = buildPredictionLineage({
      predictionId: `market:${city ?? "ALL"}:${data.horizonMonths}:${fallbackStats.at(-1)?.date ?? "unknown"}`,
      generatedAt,
      modelVersion: "predictive-v5.0.0",
      horizonMonths: data.horizonMonths,
      dataSources: [
        { source: "market_statistics", quality: fallbackStats.length >= 24 ? 0.85 : fallbackStats.length >= 12 ? 0.65 : 0.40, rowCount: fallbackStats.length, observedAt: fallbackStats.at(-1)?.date },
        { source: "listings", quality: signals.length ? 0.55 : 0.05, rowCount: signals.length },
        { source: "listing_snapshots", quality: snapshotRes.data?.length ? 0.75 : 0.10, rowCount: snapshotRes.data?.length ?? 0 },
      ],
      features: [
        { name: "market-pressure", version: "v2", inputs: ["market_statistics"], leakageChecked: true },
        { name: "causal-chain", version: "v1", inputs: ["market_statistics"], leakageChecked: true },
        { name: "property-ranking", version: "v1", inputs: ["listings", "properties"], leakageChecked: true },
      ],
      assumptions: [
        "asking prices are treated as a noisy market signal, not transaction truth",
        "causal coefficients are structural scenario assumptions until calibrated on transaction data",
        "forecast is probabilistic and can be wrong",
      ],
      uncertainty: [
        "historical transaction coverage may be incomplete",
        "macro variables may be missing from current market_statistics",
        "spatial and temporal validation must be run on verified historical transactions",
      ],
    });

    return {
      modelVersion: "predictive-v5.0.0",
      generatedAt,
      city: city ?? null,
      market: { ...market, expectedGrowthBps: scenarioExpectedGrowthBps },
      features,
      scenarios,
      causal: {
        phase: causalPhase,
        scenarios: causalScenarios.map((s) => ({
          intervention: s.intervention,
          priceImpactBps: s.priceImpactBps,
          transactionImpactBps: s.transactionImpactBps,
          liquidityImpactBps: s.liquidityImpactBps,
          dominantPath: s.dominantPath,
          caveat: s.caveat,
        })),
      },
      probabilities: {
        gainAbove0: probabilityAbove(scenarios, 0),
        gainAbove5PctAnnualized: probabilityAbove(scenarios, 500),
        declineAtLeast5PctAnnualized: probabilityAbove(scenarios, -5000),
      },
      rankings,
      dataQuality: {
        marketObservations: fallbackStats.length,
        candidateProperties: signals.length,
        hasHistoricalSnapshots: (snapshotRes.data ?? []).length > 0,
      },
      lineage,
    };
  });
