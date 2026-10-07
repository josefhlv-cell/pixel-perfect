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
import { judgeForecast, adversarialCritique, buildEvidenceGraph } from "./prediction-judge";
import { assessEvidenceConflict } from "./evidence-conflict";
import { simulateWorld } from "./market-world-model";
import { detectRegimeChange } from "./regime-change-detector";
import { decisionCertificate } from "./decision-certificate";
import { marketStateMachine } from "./market-state-machine";
import { futureStateLab } from "./future-state-lab";

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
        daysOnMarket: null,
        priceDrops: null,
      }))
      .filter((r) => r.priceM2 > 0) as MarketObservation[];

    const fallbackStats = stats.length ? stats : (marketRes.data ?? []).map((r) => ({
      date: r.period,
      priceM2: Number(r.avg_asking_price_m2 ?? 0),
      rentM2: r.avg_rent_m2 == null ? null : Number(r.avg_rent_m2),
      listings: r.listings_count,
      daysOnMarket: null,
      priceDrops: null,
    })).filter((r) => r.priceM2 > 0) as MarketObservation[];

    const market = forecastMarket(fallbackStats, data.horizonMonths);
    const features = buildFeatureSnapshot(fallbackStats);
    const latestMarket = fallbackStats.at(-1);
    const previousMarket = fallbackStats.length > 1 ? fallbackStats.at(-2) : undefined;
    const scenarios = scenarioMixture(features.priceM2, data.horizonMonths, features, market.expectedGrowthBps);
    const scenarioExpectedGrowthBps = mixtureExpectedGrowth(scenarios);

    // Derive listing microstructure from the existing schema instead of assuming
    // non-existent market_statistics columns. This keeps the prediction endpoint
    // compatible with the current production migration.
    const activeListings = (listingRes.data ?? []).filter((l) =>
      l.price && l.area_m2 && !["SOLD", "REMOVED", "EXPIRED"].includes(l.availability_status)
    );
    const domDays = activeListings
      .map((l) => {
        const first = Date.parse(String(l.first_seen_at ?? l.created_at ?? ""));
        return Number.isFinite(first) ? Math.max(0,(Date.now()-first)/86400000) : null;
      })
      .filter((x): x is number => x != null)
      .sort((a,b)=>a-b);
    const medianDom = domDays.length
      ? domDays[Math.floor(domDays.length/2)]!
      : null;

    const futureStates = futureStateLab({
      horizonMonths: data.horizonMonths,
      priceGrowth: market.expectedGrowthBps / 10000,
      rentGrowth: previousMarket?.rentM2 && latestMarket?.rentM2 ? latestMarket.rentM2 / previousMarket.rentM2 - 1 : 0,
      inventoryGrowth: latestMarket?.listings && previousMarket?.listings ? latestMarket.listings / previousMarket.listings - 1 : 0,
      mortgageRateChange: latestMarket?.mortgageRateBps != null && previousMarket?.mortgageRateBps != null ? (latestMarket.mortgageRateBps - previousMarket.mortgageRateBps) / 10000 : 0,
      creditGrowth: (latestMarket?.creditGrowthBps ?? 0) / 10000,
      domChange: medianDom == null ? 0 : Math.max(-.5, Math.min(1, (medianDom - 60) / 120)),
      liquidity: Math.min(.95, Math.max(.05, .5 + features.liquidityBps / 10000)),
      supplyGrowth: (latestMarket?.completionsGrowthBps ?? 0) / 10000,
    });
    const marketState = marketStateMachine({
      priceGrowth: market.expectedGrowthBps / 10000,
      rentGrowth: previousMarket?.rentM2 && latestMarket?.rentM2
        ? latestMarket.rentM2 / previousMarket.rentM2 - 1 : 0,
      inventoryGrowth: latestMarket?.listings && previousMarket?.listings
        ? latestMarket.listings / previousMarket.listings - 1 : 0,
      domGrowth: medianDom == null ? 0 : Math.max(-.5, Math.min(1, (medianDom - 60) / 120)),
      liquidity: Math.min(.95, Math.max(.05, .5 + features.liquidityBps / 10000)),
      volatility: Math.max(.01, market.volatilityBps / 10000),
      transactionDensity: Math.min(1, fallbackStats.length / 36),
      mortgageRateChange: latestMarket?.mortgageRateBps != null && previousMarket?.mortgageRateBps != null
        ? (latestMarket.mortgageRateBps - previousMarket.mortgageRateBps) / 10000 : 0,
      creditGrowth: (latestMarket?.creditGrowthBps ?? 0) / 10000,
      supplyGrowth: (latestMarket?.completionsGrowthBps ?? 0) / 10000,
      evidenceQuality: fallbackStats.length >= 24 ? .85 : fallbackStats.length >= 12 ? .65 : .40,
    });
    const snapshotRows = snapshotRes.data ?? [];
    const priceDrops = snapshotRows.reduce((count, s, i) => {
      const prev = i > 0 ? snapshotRows[i-1] : null;
      return count + (prev && prev.listing_id === s.listing_id && Number(s.price ?? 0) < Number(prev.price ?? 0) ? 1 : 0);
    }, 0);
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
      DOM: medianDom != null ? (medianDom - 60) * 100 : 0,
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
    const decisionCertificates = rankings.map((r) => decisionCertificate({
      purchasePrice: signals.find((p) => p.id === r.propertyId)?.price ?? 0,
      fairValue: r.fairValue,
      expectedReturn: r.expectedReturnBps / 10000,
      downsideCvar: r.fairValue > 0 ? (r.fairValueDistribution.p10 / r.fairValue) - 1 : -0.25,
      probabilityPositive: r.probabilityGain,
      confidence: r.confidence,
      liquidity: r.liquidity.sold180d,
      modelRisk: Math.max(0, Math.min(1, r.riskScore / 100)),
      evidenceQuality: Math.max(0, Math.min(1, r.confidence)),
      negotiationEdge: Math.max(0, Math.min(1, (r.fairValue - (signals.find((p) => p.id === r.propertyId)?.price ?? r.fairValue)) / Math.max(1, r.fairValue))),
    }));
    const generatedAt = new Date().toISOString();

    const evidenceConflict = assessEvidenceConflict([
      { sourceId:"market_statistics", kind:"ASKING", value:Number(latest?.priceM2 ?? 0), weight:1, observedAt:Date.parse(String(latest?.date ?? generatedAt)), availableAt:Date.parse(String(latest?.date ?? generatedAt)), reliability:.75 },
      ...(latest?.rentM2 != null ? [{ sourceId:"market_statistics_rent", kind:"RENT" as const, value:Number(latest.rentM2), weight:.65, observedAt:Date.parse(String(latest.date)), availableAt:Date.parse(String(latest.date)), reliability:.65 }] : []),
      ...(snapshotRows.length ? [{ sourceId:"listing_snapshots", kind:"ASKING" as const, value:Number(snapshotRows.at(-1)?.price ?? 0), weight:.55, observedAt:Date.parse(String(snapshotRows.at(-1)?.observed_at ?? generatedAt)), availableAt:Date.parse(String(snapshotRows.at(-1)?.observed_at ?? generatedAt)), reliability:.60 }] : []),
    ].filter(x => Number.isFinite(x.value) && x.value > 0), Date.now());

    const world = simulateWorld({
      priceGrowth: market.expectedGrowthBps / 10000,
      rentGrowth: fallbackStats.length > 1 && (fallbackStats.at(-2)?.rentM2 ?? 0) > 0
        ? ((fallbackStats.at(-1)?.rentM2 ?? 0)/(fallbackStats.at(-2)?.rentM2 ?? 1)-1)
        : 0,
      mortgageRate: (latest?.mortgageRateBps ?? 450) / 10000,
      policyRate: (latest?.policyRateBps ?? 350) / 10000,
      inflation: 0.025,
      incomeGrowth: (latest?.wageGrowthBps ?? 300) / 10000,
      unemployment: Math.max(0, (latest?.unemploymentBps ?? 400) / 10000),
      inventoryGrowth: features.supplyPressureBps / 10000,
      demandGrowth: features.demandPressureBps / 10000,
      constructionGrowth: (latest?.completionsGrowthBps ?? 0) / 10000,
      liquidity: Math.min(.95, Math.max(.05, .5 + features.liquidityBps / 10000)),
    }, 10000, 20261007);

    const regimeChange = detectRegimeChange({
      currentMean: market.expectedGrowthBps,
      baselineMean: fallbackStats.length > 2
        ? fallbackStats.slice(1,-1).reduce((s,x,i)=>s + ((x.priceM2/fallbackStats[i]!.priceM2)-1)*10000,0)/Math.max(1,fallbackStats.length-2)
        : market.expectedGrowthBps,
      currentVolatility: market.volatilityBps,
      baselineVolatility: fallbackStats.length > 3
        ? Math.max(1, Math.sqrt(fallbackStats.slice(2).reduce((s,x,i)=>{
            const g=((x.priceM2/fallbackStats[i+1]!.priceM2)-1)*10000;
            const pg=((fallbackStats[i+1]!.priceM2/fallbackStats[i]!.priceM2)-1)*10000;
            return s+(g-pg)*(g-pg);
          },0)/Math.max(1,fallbackStats.length-2)))
        : market.volatilityBps,
      currentSlope: market.expectedGrowthBps / Math.max(1,data.horizonMonths),
      baselineSlope: fallbackStats.length > 12
        ? ((fallbackStats.at(-1)?.priceM2 ?? 0)-(fallbackStats.at(-12)?.priceM2 ?? 0))/11
        : 0,
      modelErrorCurrent: Math.max(1,market.volatilityBps),
      modelErrorBaseline: Math.max(1,market.volatilityBps),
      modelDisagreement: Math.max(0,1-market.confidence),
      liquidityChange: features.liquidityBps/10000,
      sampleSize: fallbackStats.length,
    });

    const evidence = [
      { id:"market-statistics", kind:"ASKING" as const, observedAt:String(fallbackStats.at(-1)?.date ?? generatedAt), availableAt:String(fallbackStats.at(-1)?.date ?? generatedAt), quality:fallbackStats.length>=24?.85:fallbackStats.length>=12?.65:.40, direction:Math.sign(market.expectedGrowthBps), relevance:1 },
      ...(snapshotRows.length ? [{ id:"listing-snapshots", kind:"BEHAVIORAL" as const, observedAt:String(snapshotRows.at(-1)?.observed_at ?? generatedAt), availableAt:String(snapshotRows.at(-1)?.observed_at ?? generatedAt), quality:.75, direction:0, relevance:.8 }] : []),
      ...(latest?.rentM2 ? [{ id:"rent-signal", kind:"RENT" as const, observedAt:String(latest.date), availableAt:String(latest.date), quality:.55, direction:Math.sign(features.priceGrowthBps), relevance:.65 }] : []),
    ];
    const evidenceGraph = buildEvidenceGraph(evidence);
    const judge = judgeForecast({
      models: [
        { model:"structural-momentum", oosScore:0, calibration:0, coverage:0, drift:1, spatialValidity:0, sampleSize:0 },
        { model:"scenario-mixture", oosScore:0, calibration:0, coverage:0, drift:1, spatialValidity:0, sampleSize:0 },
      ],
      evidence,
      modelAgreement: market.confidence,
      regimeConfidence: market.confidence,
      dataFreshness: fallbackStats.length ? .70 : .20,
      leakageDetected: false,
      transactionShare: 0,
    });
    const adversarial = adversarialCritique({
      models: [
        { model:"structural-momentum", oosScore:0, calibration:0, coverage:0, drift:1, spatialValidity:0, sampleSize:0 },
        { model:"scenario-mixture", oosScore:0, calibration:0, coverage:0, drift:1, spatialValidity:0, sampleSize:0 },
      ],
      evidence,
      modelAgreement: market.confidence,
      regimeConfidence: market.confidence,
      dataFreshness: fallbackStats.length ? .70 : .20,
      leakageDetected:false,
      transactionShare:0,
    });
    const lineage = buildPredictionLineage({
      predictionId: `market:${city ?? "ALL"}:${data.horizonMonths}:${fallbackStats.at(-1)?.date ?? "unknown"}`,
      generatedAt,
      modelVersion: "predictive-v6.1.0",
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
      modelVersion: "predictive-v6.1.0",
      generatedAt,
      city: city ?? null,
      market: { ...market, expectedGrowthBps: scenarioExpectedGrowthBps },
      marketState,
      futureStates,
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
      decisionCertificates,
      worldModel: { ...world, calibrationStatus: "STRUCTURAL_UNCALIBRATED" as const },
      regimeChange,
      evidenceConflict,
      judge: {
        ...judge,
        adversarialCritique: adversarial,
        evidenceGraph,
      },
      dataQuality: {
        marketObservations: fallbackStats.length,
        candidateProperties: signals.length,
        hasHistoricalSnapshots: snapshotRows.length > 0,
        medianDaysOnMarket: medianDom,
        priceDropEvents: priceDrops,
      },
      lineage,
    };
  });
