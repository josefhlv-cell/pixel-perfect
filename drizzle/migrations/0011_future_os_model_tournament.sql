-- Future OS v1.9: model tournament and conditional champion registry.
CREATE TABLE IF NOT EXISTS public.reality_model_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_key text NOT NULL UNIQUE,
  model_family text NOT NULL,
  version text NOT NULL,
  description text,
  feature_contract jsonb NOT NULL DEFAULT '[]'::jsonb,
  hyperparameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reality_model_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.reality_model_candidates(id),
  geography_type text NOT NULL,
  geography_key text NOT NULL,
  horizon_days integer NOT NULL CHECK (horizon_days > 0),
  regime text,
  evaluation_cutoff timestamptz NOT NULL,
  sample_count integer NOT NULL DEFAULT 0 CHECK (sample_count >= 0),
  mae numeric,
  rmse numeric,
  directional_accuracy numeric CHECK (directional_accuracy IS NULL OR (directional_accuracy >= 0 AND directional_accuracy <= 1)),
  interval_coverage numeric CHECK (interval_coverage IS NULL OR (interval_coverage >= 0 AND interval_coverage <= 1)),
  brier_score numeric,
  log_score numeric,
  lead_time_days numeric,
  decision_utility numeric,
  regret numeric,
  calibration_error numeric,
  drift_penalty numeric,
  robustness_score numeric CHECK (robustness_score IS NULL OR (robustness_score >= 0 AND robustness_score <= 1)),
  data_quality jsonb NOT NULL DEFAULT '{}'::jsonb,
  evaluation_method text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reality_model_champions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  geography_type text NOT NULL,
  geography_key text NOT NULL,
  horizon_days integer NOT NULL CHECK (horizon_days > 0),
  regime text,
  target_key text NOT NULL,
  model_id uuid NOT NULL REFERENCES public.reality_model_candidates(id),
  score numeric NOT NULL,
  confidence numeric CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  selected_at timestamptz NOT NULL DEFAULT now(),
  selection_reason jsonb NOT NULL DEFAULT '{}'::jsonb,
  supersedes_id uuid REFERENCES public.reality_model_champions(id),
  UNIQUE(geography_type,geography_key,horizon_days,regime,target_key,selected_at)
);

CREATE INDEX IF NOT EXISTS reality_model_eval_lookup_idx
 ON public.reality_model_evaluations(model_id,geography_type,geography_key,horizon_days,regime,evaluation_cutoff DESC);

CREATE INDEX IF NOT EXISTS reality_model_champion_lookup_idx
 ON public.reality_model_champions(geography_type,geography_key,horizon_days,regime,target_key,selected_at DESC);

ALTER TABLE public.reality_model_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reality_model_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reality_model_champions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.reality_model_candidates,public.reality_model_evaluations,public.reality_model_champions FROM anon;
GRANT SELECT ON public.reality_model_candidates,public.reality_model_evaluations,public.reality_model_champions TO authenticated;
GRANT INSERT,SELECT,REFERENCES,TRIGGER ON public.reality_model_candidates,public.reality_model_evaluations,public.reality_model_champions TO service_role;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES ON public.reality_model_candidates,public.reality_model_evaluations,public.reality_model_champions FROM authenticated;
REVOKE UPDATE,DELETE,TRUNCATE ON public.reality_model_evaluations,public.reality_model_champions FROM service_role;

DROP POLICY IF EXISTS "authenticated read model candidates" ON public.reality_model_candidates;
CREATE POLICY "authenticated read model candidates" ON public.reality_model_candidates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated read model evaluations" ON public.reality_model_evaluations;
CREATE POLICY "authenticated read model evaluations" ON public.reality_model_evaluations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated read model champions" ON public.reality_model_champions;
CREATE POLICY "authenticated read model champions" ON public.reality_model_champions FOR SELECT TO authenticated USING (true);

DROP TRIGGER IF EXISTS reality_model_evaluations_no_update ON public.reality_model_evaluations;
CREATE TRIGGER reality_model_evaluations_no_update BEFORE UPDATE ON public.reality_model_evaluations FOR EACH ROW EXECUTE FUNCTION public.forbid_future_os_history_mutation();
DROP TRIGGER IF EXISTS reality_model_evaluations_no_delete ON public.reality_model_evaluations;
CREATE TRIGGER reality_model_evaluations_no_delete BEFORE DELETE ON public.reality_model_evaluations FOR EACH ROW EXECUTE FUNCTION public.forbid_future_os_history_mutation();
DROP TRIGGER IF EXISTS reality_model_champions_no_update ON public.reality_model_champions;
CREATE TRIGGER reality_model_champions_no_update BEFORE UPDATE ON public.reality_model_champions FOR EACH ROW EXECUTE FUNCTION public.forbid_future_os_history_mutation();
DROP TRIGGER IF EXISTS reality_model_champions_no_delete ON public.reality_model_champions;
CREATE TRIGGER reality_model_champions_no_delete BEFORE DELETE ON public.reality_model_champions FOR EACH ROW EXECUTE FUNCTION public.forbid_future_os_history_mutation();

INSERT INTO public.reality_model_candidates(model_key,model_family,version,description,feature_contract)
VALUES
('baseline-naive','baseline','v1','Last-value and seasonal-naive benchmark.','["target_history"]'),
('momentum','momentum','v1','Trend and acceleration benchmark.','["target_history","price_changes","liquidity"]'),
('mean-reversion','mean_reversion','v1','Deviation-from-equilibrium benchmark.','["target_history","valuation_gap"]'),
('macro-bridge','macro','v1','Macro-to-housing causal bridge.','["rates","credit","income","inflation","employment"]'),
('spatial','spatial','v1','Spatial neighborhood and connected-market model.','["micro_market","adjacent_markets","infrastructure"]'),
('temporal','temporal','v1','Multi-horizon temporal model.','["multi_frequency_history"]'),
('boosting','machine_learning','v1','Nonlinear tabular benchmark.','["all_validated_features"]'),
('ensemble','ensemble','v1','Weighted combination of tournament candidates.','["candidate_forecasts","uncertainty"]'),
('structural-twin','structural','v1','Mechanism-driven counterfactual model.','["causal_graph","elasticities","lags","shocks"]')
ON CONFLICT (model_key) DO NOTHING;
