-- Future OS v2.2: immutable forecast memory.
CREATE TABLE IF NOT EXISTS public.reality_forecast_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_id uuid NOT NULL REFERENCES public.reality_forecast_runs(id),
  memory_version text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  forecast_snapshot jsonb NOT NULL,
  evidence_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  hypothesis_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  decision_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  uncertainty_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(forecast_id,memory_version)
);

CREATE TABLE IF NOT EXISTS public.reality_forecast_memory_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id uuid NOT NULL REFERENCES public.reality_forecast_memory(id),
  observed_at timestamptz NOT NULL,
  realized_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  lesson_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  model_update_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(memory_id,observed_at)
);

CREATE INDEX IF NOT EXISTS reality_forecast_memory_lookup
 ON public.reality_forecast_memory(forecast_id,recorded_at DESC);
CREATE INDEX IF NOT EXISTS reality_forecast_memory_outcome_lookup
 ON public.reality_forecast_memory_outcomes(memory_id,observed_at DESC);

ALTER TABLE public.reality_forecast_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reality_forecast_memory_outcomes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reality_forecast_memory,public.reality_forecast_memory_outcomes FROM anon;
GRANT SELECT ON public.reality_forecast_memory,public.reality_forecast_memory_outcomes TO authenticated;
GRANT INSERT,SELECT,REFERENCES,TRIGGER ON public.reality_forecast_memory,public.reality_forecast_memory_outcomes TO service_role;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES ON public.reality_forecast_memory,public.reality_forecast_memory_outcomes FROM authenticated;
REVOKE UPDATE,DELETE,TRUNCATE ON public.reality_forecast_memory,public.reality_forecast_memory_outcomes FROM service_role;

DROP POLICY IF EXISTS "authenticated read forecast memory" ON public.reality_forecast_memory;
CREATE POLICY "authenticated read forecast memory" ON public.reality_forecast_memory FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated read forecast memory outcomes" ON public.reality_forecast_memory_outcomes;
CREATE POLICY "authenticated read forecast memory outcomes" ON public.reality_forecast_memory_outcomes FOR SELECT TO authenticated USING (true);

DROP TRIGGER IF EXISTS reality_forecast_memory_no_update ON public.reality_forecast_memory;
CREATE TRIGGER reality_forecast_memory_no_update BEFORE UPDATE ON public.reality_forecast_memory FOR EACH ROW EXECUTE FUNCTION public.forbid_future_os_history_mutation();
DROP TRIGGER IF EXISTS reality_forecast_memory_no_delete ON public.reality_forecast_memory;
CREATE TRIGGER reality_forecast_memory_no_delete BEFORE DELETE ON public.reality_forecast_memory FOR EACH ROW EXECUTE FUNCTION public.forbid_future_os_history_mutation();
DROP TRIGGER IF EXISTS reality_forecast_memory_outcomes_no_update ON public.reality_forecast_memory_outcomes;
CREATE TRIGGER reality_forecast_memory_outcomes_no_update BEFORE UPDATE ON public.reality_forecast_memory_outcomes FOR EACH ROW EXECUTE FUNCTION public.forbid_future_os_history_mutation();
DROP TRIGGER IF EXISTS reality_forecast_memory_outcomes_no_delete ON public.reality_forecast_memory_outcomes;
CREATE TRIGGER reality_forecast_memory_outcomes_no_delete BEFORE DELETE ON public.reality_forecast_memory_outcomes FOR EACH ROW EXECUTE FUNCTION public.forbid_future_os_history_mutation();
