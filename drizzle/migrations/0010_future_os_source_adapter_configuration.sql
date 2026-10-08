-- Future OS v1.8: source adapter registry is mutable configuration, not immutable evidence.
DROP TRIGGER IF EXISTS reality_source_adapters_no_update ON public.reality_source_adapters;
DROP TRIGGER IF EXISTS reality_source_adapters_no_delete ON public.reality_source_adapters;

GRANT UPDATE ON public.reality_source_adapters TO service_role;
REVOKE DELETE, TRUNCATE ON public.reality_source_adapters FROM service_role;

UPDATE public.reality_source_adapters a
SET source_id = s.id,
    updated_at = now()
FROM public.reality_evidence_sources s
WHERE a.source_id IS NULL
  AND (
    (a.adapter_key = 'oecd-housing-sdmx' AND s.source_name = 'OECD Housing Prices')
    OR (a.adapter_key = 'bis-rpp' AND s.source_name = 'BIS Residential Property Prices')
    OR (a.adapter_key = 'eurostat-prc-hpi-q' AND s.source_name = 'Eurostat Housing')
    OR (a.adapter_key = 'csu-datastat' AND s.source_name = 'Czech Statistical Office')
    OR (a.adapter_key = 'cnb-arad' AND s.source_name = 'Czech National Bank')
  );
