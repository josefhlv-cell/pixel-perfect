-- Future OS v1.5: causal graph, signal observations and forecast ledger.
-- All analytical history is append-only/versioned. Existing application tables remain untouched.

CREATE TABLE IF NOT EXISTS public.reality_causal_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edge_key text NOT NULL,
  parent_entity_type text NOT NULL,
  parent_entity_key text NOT NULL,
  child_entity_type text NOT NULL,
  child_entity_key text NOT NULL,
  mechanism text NOT NULL,
  expected_sign smallint NOT NULL CHECK (expected_sign IN (-1, 0, 1)),
  lag_min_days integer NOT NULL DEFAULT 0 CHECK (lag_min_days >= 0),
  lag_max_days integer NOT NULL DEFAULT 0 CHECK (lag_max_days >= lag_min_days),
  strength numeric CHECK (strength IS NULL OR (strength >= 0 AND strength <= 1)),
  confidence numeric CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  model_version text NOT NULL,
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  supersedes_id uuid REFERENCES public.reality_causal_edges(id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (edge_key, model_version, effective_from)
);

CREATE TABLE IF NOT EXISTS public.reality_signal_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_key text NOT NULL,
  geography_type text NOT NULL,
  geography_key text NOT NULL,
  as_of timestamptz NOT NULL,
  observed_at timestamptz,
  value numeric,
  value_json jsonb,
  unit text,
  direction smallint CHECK (direction IN (-1,0,1)),
  lead_class text NOT NULL DEFAULT 'UNKNOWN'
    CHECK (lead_class IN ('LEADING','COINCIDENT','LAGGING','UNKNOWN')),
  method_version text NOT NULL,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  independence_groups jsonb NOT NULL DEFAULT '[]'::jsonb,
  data_quality jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (signal_key, geography_type, geography_key, as_of, method_version)
);

CREATE TABLE IF NOT EXISTS public.reality_forecast_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_key text NOT NULL,
  geography_type text NOT NULL,
  geography_key text NOT NULL,
  target_key text NOT NULL,
  horizon_days integer NOT NULL CHECK (horizon_days > 0),
  data_cutoff timestamptz NOT NULL,
  forecast_created_at timestamptz NOT NULL DEFAULT now(),
  model_version text NOT NULL,
  baseline_version text NOT NULL,
  p10 numeric,
  p50 numeric,
  p90 numeric,
  probability_positive numeric CHECK (probability_positive IS NULL OR (probability_positive >= 0 AND probability_positive <= 1)),
  calibration_confidence numeric CHECK (calibration_confidence IS NULL OR (calibration_confidence >= 0 AND calibration_confidence <= 1)),
  regime text,
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','ON_TRACK','VERIFIED','FAILED','INVALIDATED')),
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  signal_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  falsifiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  assumptions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reality_forecast_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_id uuid NOT NULL REFERENCES public.reality_forecast_runs(id),
  outcome_as_of timestamptz NOT NULL,
  realized_value numeric,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  inside_interval boolean,
  absolute_error numeric,
  directional_hit boolean,
  brier_score numeric,
  log_score numeric,
  decision_regret numeric,
  verified_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (forecast_id, outcome_as_of)
);

CREATE INDEX IF NOT EXISTS reality_causal_edges_lookup_idx
  ON public.reality_causal_edges (parent_entity_type,parent_entity_key,child_entity_type,child_entity_key,effective_from DESC);
CREATE INDEX IF NOT EXISTS reality_signal_asof_idx
  ON public.reality_signal_observations (geography_type,geography_key,signal_key,as_of DESC);
CREATE INDEX IF NOT EXISTS reality_forecast_cutoff_idx
  ON public.reality_forecast_runs (geography_type,geography_key,target_key,data_cutoff DESC);
CREATE INDEX IF NOT EXISTS reality_forecast_outcome_idx
  ON public.reality_forecast_outcomes (forecast_id,outcome_as_of DESC);

CREATE OR REPLACE FUNCTION public.forbid_future_os_history_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Future OS history is immutable: % is not allowed on %', TG_OP, TG_TABLE_NAME;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['reality_causal_edges','reality_signal_observations','reality_forecast_runs','reality_forecast_outcomes']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_no_update ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER %I_no_update BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.forbid_future_os_history_mutation()', t, t);
    EXECUTE format('DROP TRIGGER IF EXISTS %I_no_delete ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER %I_no_delete BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.forbid_future_os_history_mutation()', t, t);
  END LOOP;
END $$;

ALTER TABLE public.reality_causal_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reality_signal_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reality_forecast_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reality_forecast_outcomes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.reality_causal_edges FROM anon;
REVOKE ALL ON public.reality_signal_observations FROM anon;
REVOKE ALL ON public.reality_forecast_runs FROM anon;
REVOKE ALL ON public.reality_forecast_outcomes FROM anon;

GRANT SELECT ON public.reality_causal_edges, public.reality_signal_observations, public.reality_forecast_runs, public.reality_forecast_outcomes TO authenticated;
GRANT INSERT, SELECT, REFERENCES, TRIGGER ON public.reality_causal_edges, public.reality_signal_observations, public.reality_forecast_runs, public.reality_forecast_outcomes TO service_role;

DROP POLICY IF EXISTS "authenticated read causal edges" ON public.reality_causal_edges;
CREATE POLICY "authenticated read causal edges" ON public.reality_causal_edges FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated read signal observations" ON public.reality_signal_observations;
CREATE POLICY "authenticated read signal observations" ON public.reality_signal_observations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated read forecast runs" ON public.reality_forecast_runs;
CREATE POLICY "authenticated read forecast runs" ON public.reality_forecast_runs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated read forecast outcomes" ON public.reality_forecast_outcomes;
CREATE POLICY "authenticated read forecast outcomes" ON public.reality_forecast_outcomes FOR SELECT TO authenticated USING (true);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES
  ON public.reality_causal_edges, public.reality_signal_observations, public.reality_forecast_runs, public.reality_forecast_outcomes
  FROM authenticated;
REVOKE UPDATE, DELETE, TRUNCATE
  ON public.reality_causal_edges, public.reality_signal_observations, public.reality_forecast_runs, public.reality_forecast_outcomes
  FROM service_role;
