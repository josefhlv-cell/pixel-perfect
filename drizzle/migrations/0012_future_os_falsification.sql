-- Future OS v2.0: falsification / kill-test ledger.
CREATE TABLE IF NOT EXISTS public.reality_hypotheses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hypothesis_key text NOT NULL UNIQUE,
  statement text NOT NULL,
  mechanism text NOT NULL,
  target_key text NOT NULL,
  prior_confidence numeric NOT NULL DEFAULT 0.5 CHECK (prior_confidence >= 0 AND prior_confidence <= 1),
  current_confidence numeric NOT NULL DEFAULT 0.5 CHECK (current_confidence >= 0 AND current_confidence <= 1),
  trust_cap numeric NOT NULL DEFAULT 1 CHECK (trust_cap >= 0 AND trust_cap <= 1),
  status text NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','CONTESTED','FALSIFIED','RETIRED')),
  model_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reality_falsification_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hypothesis_id uuid NOT NULL REFERENCES public.reality_hypotheses(id),
  test_key text NOT NULL,
  metric_key text NOT NULL,
  operator text NOT NULL CHECK (operator IN ('LT','LTE','GT','GTE','ABS_GT','ABS_GTE')),
  threshold numeric NOT NULL,
  evaluation_window_days integer NOT NULL CHECK (evaluation_window_days > 0),
  required_sample_count integer NOT NULL DEFAULT 10 CHECK (required_sample_count > 0),
  severity numeric NOT NULL DEFAULT 0.5 CHECK (severity >= 0 AND severity <= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(hypothesis_id,test_key)
);

CREATE TABLE IF NOT EXISTS public.reality_falsification_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.reality_falsification_tests(id),
  evaluated_at timestamptz NOT NULL,
  sample_count integer NOT NULL DEFAULT 0,
  observed_value numeric,
  passed boolean NOT NULL,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence_delta numeric NOT NULL DEFAULT 0,
  trust_cap_delta numeric NOT NULL DEFAULT 0,
  explanation jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(test_id,evaluated_at)
);

ALTER TABLE public.reality_hypotheses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reality_falsification_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reality_falsification_results ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.reality_hypotheses,public.reality_falsification_tests,public.reality_falsification_results FROM anon;
GRANT SELECT ON public.reality_hypotheses,public.reality_falsification_tests,public.reality_falsification_results TO authenticated;
GRANT INSERT,SELECT,REFERENCES,TRIGGER ON public.reality_hypotheses,public.reality_falsification_tests,public.reality_falsification_results TO service_role;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES ON public.reality_hypotheses,public.reality_falsification_tests,public.reality_falsification_results FROM authenticated;
REVOKE UPDATE,DELETE,TRUNCATE ON public.reality_falsification_results FROM service_role;

DROP POLICY IF EXISTS "authenticated read hypotheses" ON public.reality_hypotheses;
CREATE POLICY "authenticated read hypotheses" ON public.reality_hypotheses FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated read falsification tests" ON public.reality_falsification_tests;
CREATE POLICY "authenticated read falsification tests" ON public.reality_falsification_tests FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated read falsification results" ON public.reality_falsification_results;
CREATE POLICY "authenticated read falsification results" ON public.reality_falsification_results FOR SELECT TO authenticated USING (true);

DROP TRIGGER IF EXISTS reality_falsification_results_no_update ON public.reality_falsification_results;
CREATE TRIGGER reality_falsification_results_no_update BEFORE UPDATE ON public.reality_falsification_results FOR EACH ROW EXECUTE FUNCTION public.forbid_future_os_history_mutation();
DROP TRIGGER IF EXISTS reality_falsification_results_no_delete ON public.reality_falsification_results;
CREATE TRIGGER reality_falsification_results_no_delete BEFORE DELETE ON public.reality_falsification_results FOR EACH ROW EXECUTE FUNCTION public.forbid_future_os_history_mutation();

INSERT INTO public.reality_hypotheses
(hypothesis_key,statement,mechanism,target_key,prior_confidence,current_confidence,trust_cap,model_version)
VALUES
('rates-credit-demand','Rising mortgage cost reduces effective housing demand.','rates → mortgage cost → credit capacity → demand','buyer_demand',.5,.5,1,'structural-v1'),
('permits-future-supply','Higher building permits increase future competing housing supply.','permits → construction → completions → inventory','future_inventory',.5,.5,1,'structural-v1'),
('migration-rents','Positive net migration increases rental demand pressure.','migration → households → rental demand → rent','rent',.5,.5,1,'structural-v1'),
('liquidity-price-pressure','Faster absorption and lower inventory increase pricing power.','demand → liquidity → transaction pricing','transaction_price',.5,.5,1,'structural-v1')
ON CONFLICT (hypothesis_key) DO NOTHING;
