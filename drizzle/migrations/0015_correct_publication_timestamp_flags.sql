-- Adapters currently persist published_at as NULL and available_at as retrieval time.
-- The registry previously claimed a publication timestamp existed. That flag made a
-- batch import look point-in-time safe. Correct the flag only; do not invent dates.
UPDATE public.reality_source_adapters
SET publication_timestamp_available = false,
    updated_at = now(),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'publication_timestamp_reason',
      'provider payload used by the adapter has no publication timestamp; available_at is retrieval time'
    )
WHERE adapter_key IN ('cnb-arad', 'bis-rpp', 'eurostat-prc-hpi-q', 'oecd-housing-sdmx')
  AND publication_timestamp_available = true;
