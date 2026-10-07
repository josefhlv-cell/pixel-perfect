/**
 * Server adapter for Predictive Intelligence.
 * Reads the EXISTING listings/market_statistics/snapshots without replacing them.
 * Persistence is optional; this keeps v1 deploy-safe before the migration is applied.
 */
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { forecastMarket, rankProperties, type MarketObservation, type PropertySignal } from "./prediction-engine";

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
      }))
      .filter((r) => r.priceM2 > 0) as MarketObservation[];

    const fallbackStats = stats.length ? stats : (marketRes.data ?? []).map((r) => ({
      date: r.period,
      priceM2: Number(r.avg_asking_price_m2 ?? 0),
      rentM2: r.avg_rent_m2 == null ? null : Number(r.avg_rent_m2),
      listings: r.listings_count,
    })).filter((r) => r.priceM2 > 0) as MarketObservation[];

    const market = forecastMarket(fallbackStats, data.horizonMonths);

    const propertiesById = new Map((propertyRes.data ?? []).map((p) => [p.id, p]));
    const signals: PropertySignal[] = (listingRes.data ?? [])
      .filter((l) => l.price && l.area_m2 && !["SOLD", "REMOVED", "EXPIRED"].includes(l.availability_status))
      .filter((l) => !city || ((propertiesById.get(l.property_id)?.city ?? l.location ?? "").split(/[,–-]/)[0]?.trim() === city))
      .slice(0, data.limit)
      .map((l) => {
        const p = propertiesById.get(l.property_id);
        const area = Number(l.area_m2);
        return {
          id: l.id,
          price: Number(l.price),
          areaM2: area,
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
    return {
      modelVersion: "predictive-v1.0.0",
      generatedAt: new Date().toISOString(),
      city: city ?? null,
      market,
      rankings,
      dataQuality: {
        marketObservations: fallbackStats.length,
        candidateProperties: signals.length,
        hasHistoricalSnapshots: (snapshotRes.data ?? []).length > 0,
      },
    };
  });
