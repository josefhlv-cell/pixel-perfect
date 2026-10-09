/**
 * Reality Investor — Predictive Intelligence Engine v1.
 *
 * Pure TypeScript. No database, React or AI dependencies.
 * Designed to sit beside the existing deterministic calculation engine.
 *
 * Philosophy:
 * - Never return a single "future truth".
 * - Forecast a distribution and expose its uncertainty.
 * - Blend structural economics, local market momentum, comparable evidence,
 *   liquidity and scenario simulation.
 * - Every probability can be backtested and calibrated later.
 */

export type Regime = "BOOM" | "GROWTH" | "NORMAL" | "SLOWDOWN" | "DECLINE" | "STRESS";

export interface MarketObservation {
  date: string;
  priceM2: number;
  rentM2?: number | null;
  listings?: number | null;
  newListings?: number | null;
  priceDrops?: number | null;
  daysOnMarket?: number | null;
  mortgageRateBps?: number | null;
  policyRateBps?: number | null;
  inflationBps?: number | null;
  wageGrowthBps?: number | null;
  unemploymentBps?: number | null;
  populationGrowthBps?: number | null;
  completionsGrowthBps?: number | null;
  creditGrowthBps?: number | null;
  sentimentBps?: number | null;
}

export interface PropertySignal {
  id: string;
  price: number;
  areaM2: number;
  rentMonthly?: number | null;
  city?: string | null;
  rooms?: number | null;
  floor?: number | null;
  conditionScore?: number | null;
  energyScore?: number | null;
  ageYears?: number | null;
  freshnessDays?: number | null;
  priceDropBps?: number | null;
  daysOnMarket?: number | null;
  availabilityConfirmed?: boolean;
  estimatedValue?: number | null;
  estimatedRent?: number | null;
}

export interface ForecastDistribution {
  p05: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  mean: number;
  stdDev: number;
}

export interface MarketForecast {
  horizonMonths: number;
  regime: Regime;
  regimeProbabilities: Record<Regime, number>;
  expectedGrowthBps: number;
  growthDistribution: ForecastDistribution;
  expectedPriceM2: number;
  priceDistribution: ForecastDistribution;
  confidence: number;
  drivers: { factor: string; contributionBps: number; direction: "up" | "down" | "neutral" }[];
}

export interface PropertyForecast {
  propertyId: string;
  horizonMonths: number;
  fairValue: number;
  fairValueDistribution: ForecastDistribution;
  expectedReturnBps: number;
  probabilityGain: number;
  probabilityLoss: number;
  probabilityOver10Pct: number;
  probabilityPriceDrop: number;
  expectedRent: number | null;
  liquidity: { sold30d: number; sold90d: number; sold180d: number };
  investmentScore: number;
  futureEdgeScore: number;
  riskScore: number;
  confidence: number;
  recommendation: "STRONG_BUY" | "BUY" | "WATCH" | "PASS" | "INSUFFICIENT_DATA";
  reasons: string[];
}

export interface PredictionConfig {
  simulations?: number;
  seed?: number;
  baseVolatilityBps?: number;
  maxAnnualGrowthBps?: number;
  minAnnualGrowthBps?: number;
}

const REGIMES: Regime[] = ["BOOM", "GROWTH", "NORMAL", "SLOWDOWN", "DECLINE", "STRESS"];

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const mean = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const a = [...xs].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m]! : (a[m - 1]! + a[m]!) / 2;
}

function mad(xs: number[]): number {
  if (!xs.length) return 0;
  const m = median(xs);
  return median(xs.map((x) => Math.abs(x - m)));
}

function quantile(xs: number[], q: number): number {
  if (!xs.length) return 0;
  const a = [...xs].sort((x, y) => x - y);
  const p = clamp(q, 0, 1) * (a.length - 1);
  const lo = Math.floor(p);
  const hi = Math.ceil(p);
  return a[lo]! + (a[hi]! - a[lo]!) * (p - lo);
}

function pctChange(a: number, b: number): number {
  return a > 0 ? (b / a - 1) * 10_000 : 0;
}

function ewma(xs: number[], alpha = 0.35): number {
  if (!xs.length) return 0;
  let s = xs[0]!;
  for (let i = 1; i < xs.length; i++) s = alpha * xs[i]! + (1 - alpha) * s;
  return s;
}

function weightedSlope(xs: number[]): number {
  if (xs.length < 2) return 0;
  const n = xs.length;
  const w = xs.map((_, i) => Math.exp((i - n + 1) / Math.max(3, n / 3)));
  const sw = w.reduce((a, b) => a + b, 0);
  const sx = w.reduce((a, wi, i) => a + wi * i, 0) / sw;
  const sy = w.reduce((a, wi, i) => a + wi * xs[i]!, 0) / sw;
  const num = w.reduce((a, wi, i) => a + wi * (i - sx) * (xs[i]! - sy), 0);
  const den = w.reduce((a, wi, i) => a + wi * (i - sx) ** 2, 0);
  return den ? num / den : 0;
}

function normal(seed: () => number): number {
  const u = Math.max(1e-12, seed());
  const v = Math.max(1e-12, seed());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function rng(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) + 1) / 4294967297;
  };
}

function distribution(samples: number[]): ForecastDistribution {
  const m = mean(samples);
  const variance = mean(samples.map((x) => (x - m) ** 2));
  return {
    p05: quantile(samples, 0.05), p10: quantile(samples, 0.10),
    p25: quantile(samples, 0.25), p50: quantile(samples, 0.50),
    p75: quantile(samples, 0.75), p90: quantile(samples, 0.90),
    p95: quantile(samples, 0.95), mean: m, stdDev: Math.sqrt(variance),
  };
}

function regimeFromGrowth(growthBps: number, volatilityBps: number): Regime {
  if (volatilityBps > 1800 && growthBps < -500) return "STRESS";
  if (growthBps >= 900) return "BOOM";
  if (growthBps >= 250) return "GROWTH";
  if (growthBps > -250) return "NORMAL";
  if (growthBps > -900) return "SLOWDOWN";
  return "DECLINE";
}

function regimeProbabilities(growthBps: number, volBps: number): Record<Regime, number> {
  const raw = REGIMES.map((r) => {
    const center: Record<Regime, number> = { BOOM: 1200, GROWTH: 500, NORMAL: 0, SLOWDOWN: -500, DECLINE: -1200, STRESS: -2200 };
    const distance = Math.abs(growthBps - center[r]);
    return { r, v: Math.exp(-distance / Math.max(180, volBps)) };
  });
  const total = raw.reduce((a, x) => a + x.v, 0);
  return Object.fromEntries(raw.map((x) => [x.r, x.v / total])) as Record<Regime, number>;
}

/**
 * Structural market signal.
 *
 * The signs follow the Czech/international housing literature:
 * income/credit/demand support prices; higher mortgage rates and supply
 * growth restrain them; low supply elasticity amplifies demand shocks.
 */
export function structuralMarketGrowth(observations: MarketObservation[]): {
  growthBps: number;
  volatilityBps: number;
  drivers: MarketForecast["drivers"];
} {
  const usable = observations.filter((o) => o.priceM2 > 0).sort((a, b) => a.date.localeCompare(b.date));
  if (usable.length < 2) return { growthBps: 0, volatilityBps: 2200, drivers: [] };

  const prices = usable.map((o) => o.priceM2);
  const changes = prices.slice(1).map((p, i) => pctChange(prices[i]!, p));
  const momentum = ewma(changes);
  const trend = weightedSlope(prices) / Math.max(1, mean(prices)) * 10_000;
  const vol = Math.max(250, 1.4826 * mad(changes));

  const latest = usable[usable.length - 1]!;
  const prev = usable.length > 4 ? usable[usable.length - 5]! : usable[0]!;

  let growth = 0.55 * momentum + 0.45 * trend * 3;
  const drivers: MarketForecast["drivers"] = [
    { factor: "lokální momentum cen", contributionBps: Math.round(0.55 * momentum), direction: momentum >= 0 ? "up" : "down" },
    { factor: "trend cen za m²", contributionBps: Math.round(0.45 * trend * 3), direction: trend >= 0 ? "up" : "down" },
  ];

  const addFactor = (name: string, value: number | null | undefined, weight: number, sign = 1) => {
    if (value == null || !Number.isFinite(value)) return;
    const c = sign * value * weight;
    growth += c;
    drivers.push({ factor: name, contributionBps: Math.round(c), direction: c >= 0 ? "up" : "down" });
  };

  addFactor("růst mezd", latest.wageGrowthBps, 0.10);
  addFactor("růst populace", latest.populationGrowthBps, 0.12);
  addFactor("růst úvěrů", latest.creditGrowthBps, 0.06);
  addFactor("sentiment", latest.sentimentBps, 0.05);
  addFactor("inflace", latest.inflationBps, 0.015);
  addFactor("hypoteční sazba", latest.mortgageRateBps != null && prev.mortgageRateBps != null ? latest.mortgageRateBps - prev.mortgageRateBps : null, 0.55, -1);
  addFactor("růst nabídky dokončených bytů", latest.completionsGrowthBps, 0.10, -1);
  addFactor("nezaměstnanost", latest.unemploymentBps, 0.08, -1);

  // Mean-reversion guard: extreme recent appreciation gets a mild penalty.
  if (Math.abs(momentum) > 2200) {
    const correction = -Math.sign(momentum) * (Math.abs(momentum) - 2200) * 0.12;
    growth += correction;
    drivers.push({ factor: "mean-reversion guard", contributionBps: Math.round(correction), direction: correction >= 0 ? "up" : "down" });
  }

  return { growthBps: Math.round(clamp(growth, -6500, 6500)), volatilityBps: Math.round(vol), drivers };
}

export function forecastMarket(
  observations: MarketObservation[],
  horizonMonths: number,
  config: PredictionConfig = {},
): MarketForecast {
  const clean = observations.filter((o) => o.priceM2 > 0).sort((a, b) => a.date.localeCompare(b.date));
  const latest = clean.at(-1);
  if (!latest) throw new Error("Market forecast needs at least one observation.");

  const structural = structuralMarketGrowth(clean);
  const horizonYears = horizonMonths / 12;
  const seed = rng(config.seed ?? 731927 + horizonMonths);
  const simulations = Math.max(1000, Math.min(50_000, config.simulations ?? 10_000));
  const baseVol = config.baseVolatilityBps ?? structural.volatilityBps;
  const growthSamples: number[] = [];
  const priceSamples: number[] = [];

  // Correlated macro shock: rates, demand and supply are not independent.
  for (let i = 0; i < simulations; i++) {
    const z = normal(seed);
    const z2 = normal(seed);
    const rateShock = z * 450;
    const demandShock = 0.65 * z + 0.76 * z2;
    const annualGrowth = clamp(
      structural.growthBps + demandShock * 450 - rateShock * 0.22,
      config.minAnnualGrowthBps ?? -7000,
      config.maxAnnualGrowthBps ?? 7000,
    );
    const realized = annualGrowth * horizonYears + normal(seed) * baseVol * Math.sqrt(horizonYears);
    growthSamples.push(realized);
    priceSamples.push(latest.priceM2 * Math.exp(realized / 10_000));
  }

  const gd = distribution(growthSamples);
  const pd = distribution(priceSamples);
  const regime = regimeFromGrowth(structural.growthBps, structural.volatilityBps);
  const rp = regimeProbabilities(structural.growthBps, structural.volatilityBps);
  const confidence = clamp(
    0.25 + Math.min(0.35, clean.length / 120) + Math.min(0.25, (latest.listings ?? 0) / 1000) -
    Math.min(0.25, structural.volatilityBps / 20_000),
    0.05, 0.95,
  );

  return {
    horizonMonths,
    regime,
    regimeProbabilities: rp,
    expectedGrowthBps: Math.round(gd.mean),
    growthDistribution: gd,
    expectedPriceM2: Math.round(pd.mean),
    priceDistribution: pd,
    confidence,
    drivers: structural.drivers.sort((a, b) => Math.abs(b.contributionBps) - Math.abs(a.contributionBps)).slice(0, 8),
  };
}

/** Empirical conformal calibration from out-of-sample residuals. */
export function conformalInterval(prediction: number, residuals: number[], coverage = 0.90): { low: number; high: number; radius: number } {
  const q = quantile(residuals.map(Math.abs), clamp(coverage, 0.5, 0.999));
  return { low: prediction - q, high: prediction + q, radius: q };
}

function logistic(x: number): number {
  return 1 / (1 + Math.exp(-clamp(x, -40, 40)));
}

function liquidityProbability(daysOnMarket: number | null | undefined, priceGapBps: number, freshnessDays: number | null | undefined, horizonDays: number): number {
  const dom = daysOnMarket ?? 75;
  const freshness = freshnessDays ?? 30;
  const latent = 2.1 - dom / 70 - Math.max(0, priceGapBps) / 700 - freshness / 120 + Math.log(horizonDays / 30) * 0.85;
  return clamp(logistic(latent), 0.01, 0.99);
}

/**
 * Ranks actual buy candidates. It deliberately separates present-day deal quality
 * from future edge, liquidity and model confidence.
 */
export function rankProperties(
  properties: PropertySignal[],
  market: MarketForecast,
  config: PredictionConfig = {},
): PropertyForecast[] {
  const simulations = Math.max(1000, Math.min(50_000, config.simulations ?? 10_000));
  const results: PropertyForecast[] = [];

  for (const p of properties) {
    if (!(p.price > 0 && p.areaM2 > 0)) {
      results.push({
        propertyId: p.id, horizonMonths: market.horizonMonths, fairValue: 0,
        fairValueDistribution: distribution([]), expectedReturnBps: 0,
        probabilityGain: 0, probabilityLoss: 0, probabilityOver10Pct: 0, probabilityPriceDrop: 0,
        expectedRent: p.estimatedRent ?? p.rentMonthly ?? null,
        liquidity: { sold30d: 0, sold90d: 0, sold180d: 0 },
        investmentScore: 0, futureEdgeScore: 0, riskScore: 100, confidence: 0,
        recommendation: "INSUFFICIENT_DATA", reasons: ["Chybí cena nebo plocha."],
      });
      continue;
    }

    const priceGap = p.estimatedValue ? pctChange(p.price, p.estimatedValue) : 0;
    const localFair = p.estimatedValue ?? market.expectedPriceM2 * p.areaM2;
    const expectedGrowth = market.expectedGrowthBps / 10_000;
    const seed = rng((config.seed ?? 8123) + p.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0));
    const values: number[] = [];
    let gains = 0, losses = 0, over10 = 0, drops = 0;

    for (let i = 0; i < simulations; i++) {
      const macro = normal(seed) * market.priceDistribution.stdDev / Math.max(1, market.expectedPriceM2);
      const idio = normal(seed) * Math.max(0.025, market.priceDistribution.stdDev / Math.max(1, market.expectedPriceM2) * 0.45);
      const value = localFair * Math.exp(expectedGrowth + macro + idio);
      values.push(value);
      const ret = value / p.price - 1;
      if (ret > 0) gains++;
      if (ret < 0) losses++;
      if (ret >= 0.10) over10++;
      if (ret <= -0.10) drops++;
    }

    const fd = distribution(values);
    const expectedReturn = fd.mean / p.price - 1;
    const rent = p.estimatedRent ?? p.rentMonthly ?? null;
    const grossYield = rent ? (rent * 12) / p.price : 0;
    const liquidity = {
      sold30d: liquidityProbability(p.daysOnMarket, priceGap, p.freshnessDays, 30),
      sold90d: liquidityProbability(p.daysOnMarket, priceGap, p.freshnessDays, 90),
      sold180d: liquidityProbability(p.daysOnMarket, priceGap, p.freshnessDays, 180),
    };

    const deal = clamp(((-priceGap) / 2500) * 35 + grossYield * 1000, 0, 45);
    const future = clamp(expectedReturn * 100 + (gains / simulations) * 30 + (over10 / simulations) * 20, 0, 55);
    const liquidityScore = liquidity.sold180d * 10;
    const dataConfidence = clamp(
      0.25 + (p.estimatedValue ? 0.25 : 0) + (p.estimatedRent || p.rentMonthly ? 0.15 : 0) +
      (p.availabilityConfirmed ? 0.10 : 0) + (p.daysOnMarket != null ? 0.10 : 0) +
      Math.min(0.15, market.confidence * 0.2),
      0.05, 0.95,
    );
    const risk = clamp(
      55 - expectedReturn * 120 - (p.availabilityConfirmed ? 8 : 0) - liquidity.sold180d * 10 +
      Math.max(0, priceGap) / 80 + market.priceDistribution.stdDev / Math.max(1, market.expectedPriceM2) * 30,
      0, 100,
    );
    const score = clamp((deal * 0.42 + future * 0.40 + liquidityScore * 0.18) * dataConfidence - risk * 0.12, 0, 100);

    const reasons: string[] = [];
    if (priceGap <= -500) reasons.push(`Nabídka je přibližně ${Math.abs(priceGap / 100).toFixed(1)} % pod současnou férovou hodnotou.`);
    if (expectedReturn >= 0.08) reasons.push(`Model čeká kladný budoucí edge; medián simulace je nad nákupní cenou.`);
    if (grossYield >= 0.05) reasons.push(`Silný hrubý nájemní výnos ${(grossYield * 100).toFixed(2)} %.`);
    if (liquidity.sold180d < 0.45) reasons.push("Nižší likvidita: počítej s delším výstupem.");
    if (market.regime === "BOOM") reasons.push("Trh je v modelu v režimu BOOM; upside roste, ale roste i riziko přecenění.");
    if (market.regime === "STRESS" || market.regime === "DECLINE") reasons.push("Makro režim zvyšuje riziko poklesu.");
    if (!p.estimatedValue) reasons.push("Chybí individuální AVM; férová hodnota používá lokální tržní projekci.");

    results.push({
      propertyId: p.id,
      horizonMonths: market.horizonMonths,
      fairValue: Math.round(fd.mean),
      fairValueDistribution: fd,
      expectedReturnBps: Math.round(expectedReturn * 10_000),
      probabilityGain: gains / simulations,
      probabilityLoss: losses / simulations,
      probabilityOver10Pct: over10 / simulations,
      probabilityPriceDrop: drops / simulations,
      expectedRent: rent,
      liquidity,
      investmentScore: Math.round(score),
      futureEdgeScore: Math.round(future),
      riskScore: Math.round(risk),
      confidence: dataConfidence,
      recommendation: score >= 78 ? "STRONG_BUY" : score >= 62 ? "BUY" : score >= 45 ? "WATCH" : "PASS",
      reasons,
    });
  }

  return results.sort((a, b) => b.investmentScore - a.investmentScore);
}

export interface BacktestPoint {
  date: string;
  predicted: number;
  actual: number;
  error: number;
  absolutePercentageError: number;
}

export interface BacktestResult {
  points: BacktestPoint[];
  mae: number;
  mape: number;
  bias: number;
  directionalAccuracy: number;
  coverage90: number;
}

/**
 * Walk-forward backtest. No future observations are allowed into each prediction.
 */
export function walkForwardBacktest(
  observations: MarketObservation[],
  horizonSteps = 1,
): BacktestResult {
  const rows = observations.filter((o) => o.priceM2 > 0).sort((a, b) => a.date.localeCompare(b.date));
  const points: BacktestPoint[] = [];
  for (let i = 8; i + horizonSteps < rows.length; i++) {
    const train = rows.slice(0, i);
    const forecast = forecastMarket(train, horizonSteps * 3, { simulations: 2500, seed: i + 100 });
    const actual = rows[i + horizonSteps]!.priceM2;
    const predicted = forecast.priceDistribution.p50;
    const error = actual - predicted;
    points.push({
      date: rows[i + horizonSteps]!.date,
      predicted, actual, error,
      absolutePercentageError: Math.abs(error) / Math.max(1, actual),
    });
  }
  if (!points.length) return { points, mae: 0, mape: 0, bias: 0, directionalAccuracy: 0, coverage90: 0 };
  const directional = points.filter((p, i) => {
    if (!i) return true;
    return Math.sign(p.actual - points[i - 1]!.actual) === Math.sign(p.predicted - points[i - 1]!.predicted);
  }).length / points.length;
  return {
    points,
    mae: mean(points.map((p) => Math.abs(p.error))),
    mape: mean(points.map((p) => p.absolutePercentageError)),
    bias: mean(points.map((p) => p.error)),
    directionalAccuracy: directional,
    coverage90: 0,
  };
}
