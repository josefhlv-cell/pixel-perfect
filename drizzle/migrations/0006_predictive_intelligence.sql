-- Predictive Intelligence v1
-- Additive only: no existing table/column is altered or removed.
-- All exposed tables have RLS. Market observations are global research data;
-- property forecasts are user-scoped outputs.

CREATE TABLE IF NOT EXISTS public.market_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  observed_at date NOT NULL,
  price_m2 numeric,
  rent_m2 numeric,
  listings_count integer,
  new_listings_count integer,
  price_drop_count integer,
  median_days_on_market integer,
  mortgage_rate_bps integer,
  policy_rate_bps integer,
  inflation_bps integer,
  wage_growth_bps integer,
  unemployment_bps integer,
  population_growth_bps integer,
  completions_growth_bps integer,
  credit_growth_bps integer,
  sentiment_bps integer,
  source text,
  source_url text,
  is_sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(city, observed_at, source)
);

CREATE TABLE IF NOT EXISTS public.market_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  forecasted_at timestamptz NOT NULL DEFAULT now(),
  horizon_months integer NOT NULL,
  regime text NOT NULL,
  expected_growth_bps integer NOT NULL,
  p05_growth_bps integer NOT NULL,
  p10_growth_bps integer NOT NULL,
  p25_growth_bps integer NOT NULL,
  p50_growth_bps integer NOT NULL,
  p75_growth_bps integer NOT NULL,
  p90_growth_bps integer NOT NULL,
  p95_growth_bps integer NOT NULL,
  expected_price_m2 numeric,
  p10_price_m2 numeric,
  p50_price_m2 numeric,
  p90_price_m2 numeric,
  confidence numeric NOT NULL,
  drivers jsonb NOT NULL DEFAULT '[]'::jsonb,
  model_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.property_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id uuid NOT NULL,
  listing_id uuid,
  forecasted_at timestamptz NOT NULL DEFAULT now(),
  horizon_months integer NOT NULL,
  fair_value numeric,
  p10_value numeric,
  p50_value numeric,
  p90_value numeric,
  expected_return_bps integer,
  probability_gain numeric,
  probability_loss numeric,
  probability_over_10pct numeric,
  probability_price_drop numeric,
  expected_rent numeric,
  sold_30d_probability numeric,
  sold_90d_probability numeric,
  sold_180d_probability numeric,
  investment_score integer,
  future_edge_score integer,
  risk_score integer,
  confidence numeric,
  recommendation text,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  model_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.forecast_backtests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text,
  horizon_months integer NOT NULL,
  model_version text NOT NULL,
  run_at timestamptz NOT NULL DEFAULT now(),
  observations_count integer NOT NULL DEFAULT 0,
  mae numeric,
  mape numeric,
  bias numeric,
  directional_accuracy numeric,
  coverage_90 numeric,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.prediction_model_versions (
  version text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  description text NOT NULL,
  methodology jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT false
);

ALTER TABLE public.market_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_backtests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prediction_model_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "market_observations_read_authenticated" ON public.market_observations;
CREATE POLICY "market_observations_read_authenticated"
  ON public.market_observations FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "market_forecasts_read_authenticated" ON public.market_forecasts;
CREATE POLICY "market_forecasts_read_authenticated"
  ON public.market_forecasts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "property_forecasts_owner_select" ON public.property_forecasts;
CREATE POLICY "property_forecasts_owner_select"
  ON public.property_forecasts FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "forecast_backtests_read_authenticated" ON public.forecast_backtests;
CREATE POLICY "forecast_backtests_read_authenticated"
  ON public.forecast_backtests FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "prediction_model_versions_read_authenticated" ON public.prediction_model_versions;
CREATE POLICY "prediction_model_versions_read_authenticated"
  ON public.prediction_model_versions FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.market_observations TO authenticated;
GRANT SELECT ON public.market_forecasts TO authenticated;
GRANT SELECT ON public.property_forecasts TO authenticated;
GRANT SELECT ON public.forecast_backtests TO authenticated;
GRANT SELECT ON public.prediction_model_versions TO authenticated;

INSERT INTO public.prediction_model_versions(version, description, methodology, active)
VALUES (
  'predictive-v1.0.0',
  'Probabilistic housing market intelligence: structural factors + local momentum + Monte Carlo + liquidity + walk-forward backtesting.',
  '{"components":["structural-economic","local-momentum","probabilistic-forecast","monte-carlo","liquidity","walk-forward-backtest","uncertainty-calibration"],"outputs":"distributions_not_point_truth"}'::jsonb,
  true
)
ON CONFLICT (version) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_market_observations_city_date
  ON public.market_observations(city, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_forecasts_city_horizon
  ON public.market_forecasts(city, horizon_months, forecasted_at DESC);
CREATE INDEX IF NOT EXISTS idx_property_forecasts_user_property
  ON public.property_forecasts(user_id, property_id, forecasted_at DESC);
