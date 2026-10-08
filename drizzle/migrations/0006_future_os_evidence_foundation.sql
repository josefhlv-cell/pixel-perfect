-- Future OS: Point-in-Time Evidence + World State foundation
-- Append-only provenance layer. No existing tables/data are modified.

CREATE TABLE IF NOT EXISTS public.reality_evidence_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name text NOT NULL,
  source_type text NOT NULL,
  publisher text,
  canonical_url text,
  geography_scope text,
  default_reliability numeric NOT NULL DEFAULT 0.5 CHECK (default_reliability >= 0 AND default_reliability <= 1),
  independence_group text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_name, source_type)
);

CREATE TABLE IF NOT EXISTS public.reality_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.reality_evidence_sources(id),
  source_url text,
  source_name text NOT NULL,
  source_type text NOT NULL,
  publisher text,
  geography_type text NOT NULL,
  geography_key text NOT NULL,
  entity_type text NOT NULL,
  entity_key text NOT NULL,
  observed_at timestamptz,
  published_at timestamptz,
  retrieved_at timestamptz NOT NULL,
  available_at timestamptz NOT NULL,
  effective_from timestamptz,
  effective_to timestamptz,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  value jsonb NOT NULL,
  unit text,
  frequency text,
  lead_class text NOT NULL DEFAULT 'UNKNOWN'
    CHECK (lead_class IN ('LEADING','COINCIDENT','LAGGING','UNKNOWN')),
  source_reliability numeric NOT NULL DEFAULT 0.5
    CHECK (source_reliability >= 0 AND source_reliability <= 1),
  independence_group text NOT NULL,
  content_hash text NOT NULL,
  is_revision boolean NOT NULL DEFAULT false,
  supersedes_id uuid REFERENCES public.reality_evidence(id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (published_at IS NULL OR published_at <= available_at),
  CHECK (retrieved_at <= available_at OR available_at = retrieved_at),
  UNIQUE (source_id, geography_type, geography_key, entity_type, entity_key, revision, content_hash)
);

CREATE INDEX IF NOT EXISTS reality_evidence_asof_idx
  ON public.reality_evidence (geography_key, entity_type, entity_key, available_at DESC, revision DESC);
CREATE INDEX IF NOT EXISTS reality_evidence_series_idx
  ON public.reality_evidence (source_id, geography_type, geography_key, entity_type, entity_key, available_at DESC);
CREATE INDEX IF NOT EXISTS reality_evidence_observed_idx
  ON public.reality_evidence (observed_at DESC);
CREATE INDEX IF NOT EXISTS reality_evidence_lead_idx
  ON public.reality_evidence (lead_class, available_at DESC);
CREATE INDEX IF NOT EXISTS reality_evidence_hash_idx
  ON public.reality_evidence (content_hash);

CREATE TABLE IF NOT EXISTS public.reality_world_state_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  geography_type text NOT NULL,
  geography_key text NOT NULL,
  as_of timestamptz NOT NULL,
  state jsonb NOT NULL,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_count integer NOT NULL DEFAULT 0 CHECK (evidence_count >= 0),
  missingness jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence numeric CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  regime text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reality_world_state_asof_idx
  ON public.reality_world_state_snapshots (geography_type, geography_key, as_of DESC);

CREATE OR REPLACE FUNCTION public.forbid_reality_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Reality Evidence is immutable: % is not allowed on %', TG_OP, TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS reality_evidence_no_update ON public.reality_evidence;
CREATE TRIGGER reality_evidence_no_update
  BEFORE UPDATE ON public.reality_evidence
  FOR EACH ROW EXECUTE FUNCTION public.forbid_reality_evidence_mutation();

DROP TRIGGER IF EXISTS reality_evidence_no_delete ON public.reality_evidence;
CREATE TRIGGER reality_evidence_no_delete
  BEFORE DELETE ON public.reality_evidence
  FOR EACH ROW EXECUTE FUNCTION public.forbid_reality_evidence_mutation();

DROP TRIGGER IF EXISTS reality_world_state_no_update ON public.reality_world_state_snapshots;
CREATE TRIGGER reality_world_state_no_update
  BEFORE UPDATE ON public.reality_world_state_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.forbid_reality_evidence_mutation();

DROP TRIGGER IF EXISTS reality_world_state_no_delete ON public.reality_world_state_snapshots;
CREATE TRIGGER reality_world_state_no_delete
  BEFORE DELETE ON public.reality_world_state_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.forbid_reality_evidence_mutation();

ALTER TABLE public.reality_evidence_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reality_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reality_world_state_snapshots ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.reality_evidence_sources FROM anon;
REVOKE ALL ON public.reality_evidence FROM anon;
REVOKE ALL ON public.reality_world_state_snapshots FROM anon;

GRANT SELECT ON public.reality_evidence_sources TO authenticated;
GRANT SELECT ON public.reality_evidence TO authenticated;
GRANT SELECT ON public.reality_world_state_snapshots TO authenticated;
GRANT ALL ON public.reality_evidence_sources TO service_role;
GRANT ALL ON public.reality_evidence TO service_role;
GRANT ALL ON public.reality_world_state_snapshots TO service_role;

DROP POLICY IF EXISTS "authenticated read evidence sources" ON public.reality_evidence_sources;
CREATE POLICY "authenticated read evidence sources"
  ON public.reality_evidence_sources FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated read reality evidence" ON public.reality_evidence;
CREATE POLICY "authenticated read reality evidence"
  ON public.reality_evidence FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated read world state snapshots" ON public.reality_world_state_snapshots;
CREATE POLICY "authenticated read world state snapshots"
  ON public.reality_world_state_snapshots FOR SELECT TO authenticated USING (true);

-- Only the trusted server/service role can ingest immutable evidence.
REVOKE INSERT, UPDATE, DELETE ON public.reality_evidence FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.reality_evidence_sources FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.reality_world_state_snapshots FROM authenticated;

-- Latest revision known by a historical cutoff. The cutoff is INFORMATION-AVAILABILITY time.
CREATE OR REPLACE FUNCTION public.get_reality_evidence_available_at(
  p_as_of timestamptz,
  p_geography_type text DEFAULT NULL,
  p_geography_key text DEFAULT NULL
)
RETURNS SETOF public.reality_evidence
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH eligible AS (
    SELECT e.*,
      row_number() OVER (
        PARTITION BY e.source_id, e.geography_type, e.geography_key, e.entity_type, e.entity_key
        ORDER BY e.available_at DESC, e.revision DESC, e.created_at DESC
      ) AS rn
    FROM public.reality_evidence e
    WHERE e.available_at <= p_as_of
      AND (p_geography_type IS NULL OR e.geography_type = p_geography_type)
      AND (p_geography_key IS NULL OR e.geography_key = p_geography_key)
  )
  SELECT
    id, source_id, source_url, source_name, source_type, publisher,
    geography_type, geography_key, entity_type, entity_key,
    observed_at, published_at, retrieved_at, available_at,
    effective_from, effective_to, revision, value, unit, frequency,
    lead_class, source_reliability, independence_group, content_hash,
    is_revision, supersedes_id, metadata, created_at
  FROM eligible
  WHERE rn = 1;
$$;

REVOKE ALL ON FUNCTION public.get_reality_evidence_available_at(timestamptz, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_reality_evidence_available_at(timestamptz, text, text) TO authenticated, service_role;

-- Seed only source definitions; no fabricated measurements.
INSERT INTO public.reality_evidence_sources
  (source_name, source_type, publisher, canonical_url, geography_scope, default_reliability, independence_group, metadata)
VALUES
  ('OECD Housing Prices', 'official_statistical', 'OECD', 'https://www.oecd.org/en/data/indicators/housing-prices.html', 'global', 0.95, 'oecd', '{"adapter":"oecd-housing"}'),
  ('BIS Residential Property Prices', 'official_statistical', 'BIS', 'https://www.bis.org/statistics/pp.htm', 'global', 0.98, 'bis', '{"adapter":"bis-rpp"}'),
  ('Eurostat Housing', 'official_statistical', 'Eurostat', 'https://ec.europa.eu/eurostat/', 'europe', 0.97, 'eurostat', '{"adapter":"eurostat-housing"}'),
  ('Czech Statistical Office', 'official_statistical', 'ČSÚ', 'https://csu.gov.cz/', 'czechia', 0.98, 'csu', '{"adapter":"csu"}'),
  ('Czech National Bank', 'official_statistical', 'ČNB', 'https://www.cnb.cz/', 'czechia', 0.98, 'cnb', '{"adapter":"cnb"}')
ON CONFLICT (source_name, source_type) DO NOTHING;
