-- Future OS v2.1: learned signal discovery and market DNA.
CREATE TABLE IF NOT EXISTS public.reality_market_dna (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  geography_type text NOT NULL,
  geography_key text NOT NULL,
  as_of timestamptz NOT NULL,
  horizon_days integer NOT NULL CHECK (horizon_days > 0),
  parameter_key text NOT NULL,
  value numeric,
  low_value numeric,
  high_value numeric,
  sample_count integer NOT NULL DEFAULT 0,
  confidence numeric CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  method_version text NOT NULL,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(geography_type,geography_key,as_of,horizon_days,parameter_key,method_version)
);

CREATE TABLE IF NOT EXISTS public.reality_signal_lead_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  geography_type text NOT NULL,
  geography_key text NOT NULL,
  signal_key text NOT NULL,
  target_key text NOT NULL,
  lag_days integer NOT NULL CHECK (lag_days > 0),
  window_days integer NOT NULL CHECK (window_days > 0),
  evaluation_cutoff timestamptz NOT NULL,
  sample_count integer NOT NULL DEFAULT 0,
  correlation numeric,
  rank_correlation numeric,
  directional_accuracy numeric,
  mutual_information numeric,
  stability numeric,
  false_alarm_rate numeric,
  lead_score numeric,
  independence_adjusted_score numeric,
  p_value numeric,
  method_version text NOT NULL,
  status text NOT NULL DEFAULT 'CANDIDATE'
    CHECK (status IN ('CANDIDATE','VALIDATED','REJECTED','DRIFTING')),
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reality_market_dna_lookup
 ON public.reality_market_dna(geography_type,geography_key,parameter_key,horizon_days,as_of DESC);
CREATE INDEX IF NOT EXISTS reality_signal_lead_lookup
 ON public.reality_signal_lead_tests(geography_type,geography_key,target_key,lead_score DESC,evaluation_cutoff DESC);

ALTER TABLE public.reality_market_dna ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reality_signal_lead_tests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reality_market_dna,public.reality_signal_lead_tests FROM anon;
GRANT SELECT ON public.reality_market_dna,public.reality_signal_lead_tests TO authenticated;
GRANT INSERT,SELECT,REFERENCES,TRIGGER ON public.reality_market_dna,public.reality_signal_lead_tests TO service_role;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES ON public.reality_market_dna,public.reality_signal_lead_tests FROM authenticated;
REVOKE UPDATE,DELETE,TRUNCATE ON public.reality_market_dna,public.reality_signal_lead_tests FROM service_role;

DROP POLICY IF EXISTS "authenticated read market dna" ON public.reality_market_dna;
CREATE POLICY "authenticated read market dna" ON public.reality_market_dna FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated read lead tests" ON public.reality_signal_lead_tests;
CREATE POLICY "authenticated read lead tests" ON public.reality_signal_lead_tests FOR SELECT TO authenticated USING (true);

DROP TRIGGER IF EXISTS reality_market_dna_no_update ON public.reality_market_dna;
CREATE TRIGGER reality_market_dna_no_update BEFORE UPDATE ON public.reality_market_dna FOR EACH ROW EXECUTE FUNCTION public.forbid_future_os_history_mutation();
DROP TRIGGER IF EXISTS reality_market_dna_no_delete ON public.reality_market_dna;
CREATE TRIGGER reality_market_dna_no_delete BEFORE DELETE ON public.reality_market_dna FOR EACH ROW EXECUTE FUNCTION public.forbid_future_os_history_mutation();
DROP TRIGGER IF EXISTS reality_signal_lead_tests_no_update ON public.reality_signal_lead_tests;
CREATE TRIGGER reality_signal_lead_tests_no_update BEFORE UPDATE ON public.reality_signal_lead_tests FOR EACH ROW EXECUTE FUNCTION public.forbid_future_os_history_mutation();
DROP TRIGGER IF EXISTS reality_signal_lead_tests_no_delete ON public.reality_signal_lead_tests;
CREATE TRIGGER reality_signal_lead_tests_no_delete BEFORE DELETE ON public.reality_signal_lead_tests FOR EACH ROW EXECUTE FUNCTION public.forbid_future_os_history_mutation();
