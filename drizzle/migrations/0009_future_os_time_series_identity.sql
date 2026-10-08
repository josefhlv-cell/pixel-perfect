-- Future OS v1.7: fix time-series identity for point-in-time reconstruction.
DROP INDEX IF EXISTS public.reality_evidence_source_id_geography_type_geography_key_ent_key;

CREATE UNIQUE INDEX IF NOT EXISTS reality_evidence_observation_identity_idx
  ON public.reality_evidence (
    source_id, geography_type, geography_key, entity_type, entity_key,
    COALESCE(effective_from, observed_at, created_at), revision
  );

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
        PARTITION BY
          e.source_id,
          e.geography_type,
          e.geography_key,
          e.entity_type,
          e.entity_key,
          COALESCE(e.effective_from, e.observed_at, e.created_at)
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
