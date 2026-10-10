-- Future OS: immutable point-in-time source snapshots for honest walk-forward evaluation.
-- Snapshot rows are append-only. A snapshot's retrieved_at is when the application actually
-- observed the source, not an inferred publication date.
CREATE TABLE IF NOT EXISTS public.reality_source_vintages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text NOT NULL,
  series_key text NOT NULL,
  geography_key text NOT NULL,
  period_key text NOT NULL,
  source_published_at timestamptz,
  retrieved_at timestamptz NOT NULL,
  source_revision text,
  numeric_value numeric,
  unit text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload_hash text NOT NULL,
  quality text NOT NULL CHECK (quality IN ('OBSERVED_VINTAGE','RETRIEVAL_SNAPSHOT','ASSUMED_PUBLICATION_LAG')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_key,series_key,geography_key,period_key,retrieved_at,payload_hash)
);

CREATE INDEX IF NOT EXISTS reality_source_vintages_asof_idx
  ON public.reality_source_vintages(source_key,series_key,geography_key,retrieved_at,period_key);
CREATE INDEX IF NOT EXISTS reality_source_vintages_period_idx
  ON public.reality_source_vintages(series_key,geography_key,period_key,retrieved_at DESC);

ALTER TABLE public.reality_source_vintages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reality_source_vintages FROM anon;
GRANT SELECT ON public.reality_source_vintages TO authenticated;
GRANT INSERT,SELECT,REFERENCES,TRIGGER ON public.reality_source_vintages TO service_role;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES ON public.reality_source_vintages FROM authenticated;
REVOKE UPDATE,DELETE,TRUNCATE ON public.reality_source_vintages FROM service_role;

DROP POLICY IF EXISTS "authenticated read source vintages" ON public.reality_source_vintages;
CREATE POLICY "authenticated read source vintages"
  ON public.reality_source_vintages FOR SELECT TO authenticated USING (true);

DROP TRIGGER IF EXISTS reality_source_vintages_no_update ON public.reality_source_vintages;
CREATE TRIGGER reality_source_vintages_no_update
  BEFORE UPDATE ON public.reality_source_vintages
  FOR EACH ROW EXECUTE FUNCTION public.forbid_future_os_history_mutation();
DROP TRIGGER IF EXISTS reality_source_vintages_no_delete ON public.reality_source_vintages;
CREATE TRIGGER reality_source_vintages_no_delete
  BEFORE DELETE ON public.reality_source_vintages
  FOR EACH ROW EXECUTE FUNCTION public.forbid_future_os_history_mutation();
