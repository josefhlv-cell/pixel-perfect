-- Predictive Intelligence v2: feature store, macro observations, scenarios and calibration.
CREATE TABLE IF NOT EXISTS public.macro_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL DEFAULT 'CZ',
  observed_at date NOT NULL,
  mortgage_rate_bps integer,
  policy_rate_bps integer,
  inflation_bps integer,
  wage_growth_bps integer,
  unemployment_bps integer,
  gdp_growth_bps integer,
  credit_growth_bps integer,
  population_growth_bps integer,
  building_permits_growth_bps integer,
  completions_growth_bps integer,
  sentiment_bps integer,
  source text NOT NULL,
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(country_code, observed_at, source)
);

CREATE TABLE IF NOT EXISTS public.prediction_feature_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  observed_at date NOT NULL,
  feature_version text NOT NULL,
  price_m2 numeric,
  price_growth_bps integer,
  inventory_count integer,
  new_listing_rate_bps integer,
  price_cut_rate_bps integer,
  median_dom integer,
  liquidity_bps integer,
  demand_pressure_bps integer,
  supply_pressure_bps integer,
  affordability_bps integer,
  momentum_bps integer,
  volatility_bps integer,
  source_quality_bps integer,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(city, observed_at, feature_version)
);

CREATE TABLE IF NOT EXISTS public.prediction_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  horizon_months integer NOT NULL,
  scenario text NOT NULL,
  probability numeric NOT NULL,
  growth_bps integer NOT NULL,
  price_m2 numeric,
  assumptions jsonb NOT NULL DEFAULT '{}'::jsonb,
  model_version text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.prediction_calibration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text,
  horizon_months integer NOT NULL,
  model_version text NOT NULL,
  run_at timestamptz NOT NULL DEFAULT now(),
  sample_count integer NOT NULL DEFAULT 0,
  mae numeric,
  rmse numeric,
  mape numeric,
  bias numeric,
  directional_accuracy numeric,
  interval_80_coverage numeric,
  interval_90_coverage numeric,
  brier_score numeric,
  log_loss numeric,
  calibration_error numeric,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.macro_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prediction_feature_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prediction_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prediction_calibration ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "macro_observations_read_authenticated" ON public.macro_observations;
CREATE POLICY "macro_observations_read_authenticated" ON public.macro_observations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "prediction_features_read_authenticated" ON public.prediction_feature_snapshots;
CREATE POLICY "prediction_features_read_authenticated" ON public.prediction_feature_snapshots FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "prediction_scenarios_read_authenticated" ON public.prediction_scenarios;
CREATE POLICY "prediction_scenarios_read_authenticated" ON public.prediction_scenarios FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "prediction_calibration_read_authenticated" ON public.prediction_calibration;
CREATE POLICY "prediction_calibration_read_authenticated" ON public.prediction_calibration FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.macro_observations TO authenticated;
GRANT SELECT ON public.prediction_feature_snapshots TO authenticated;
GRANT SELECT ON public.prediction_scenarios TO authenticated;
GRANT SELECT ON public.prediction_calibration TO authenticated;

CREATE INDEX IF NOT EXISTS idx_macro_observations_date ON public.macro_observations(country_code, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_prediction_features_city_date ON public.prediction_feature_snapshots(city, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_prediction_scenarios_city_horizon ON public.prediction_scenarios(city, horizon_months, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_prediction_calibration_model ON public.prediction_calibration(model_version, run_at DESC);

INSERT INTO public.prediction_model_versions(version, description, methodology, active)
VALUES (
  'predictive-v2.0.0',
  'Regime-aware probabilistic real-estate intelligence with behavioral listing features, macro factors, scenario distributions and calibration metrics.',
  '{"components":["hedonic-ready-feature-store","market-momentum","supply-demand-pressure","seller-behaviour","macro-regime","correlated-monte-carlo","scenario-mixture","walk-forward-calibration"],"principle":"probabilities_not_certainty"}'::jsonb,
  true
)
ON CONFLICT (version) DO UPDATE SET description=EXCLUDED.description, methodology=EXCLUDED.methodology, active=true;

UPDATE public.prediction_model_versions SET active=false WHERE version <> 'predictive-v2.0.0';
