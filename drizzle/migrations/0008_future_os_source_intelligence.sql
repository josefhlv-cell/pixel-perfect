-- Future OS v1.6: source intelligence registry.
CREATE TABLE IF NOT EXISTS public.reality_source_adapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.reality_evidence_sources(id),
  adapter_key text NOT NULL UNIQUE,
  source_name text NOT NULL,
  publisher text,
  canonical_url text,
  access_protocol text NOT NULL,
  data_domains jsonb NOT NULL DEFAULT '[]'::jsonb,
  geography_scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  frequencies jsonb NOT NULL DEFAULT '[]'::jsonb,
  latency_class text NOT NULL DEFAULT 'UNKNOWN'
    CHECK (latency_class IN ('REALTIME','INTRADAY','DAILY','WEEKLY','MONTHLY','QUARTERLY','ANNUAL','UNKNOWN')),
  historical_start text,
  revision_policy text,
  publication_timestamp_available boolean NOT NULL DEFAULT false,
  retrieval_timestamp_recorded boolean NOT NULL DEFAULT true,
  point_in_time_safe boolean NOT NULL DEFAULT false,
  reliability numeric CHECK (reliability IS NULL OR (reliability >= 0 AND reliability <= 1)),
  independence_group text NOT NULL,
  status text NOT NULL DEFAULT 'PLANNED'
    CHECK (status IN ('PLANNED','ACTIVE','DEGRADED','BLOCKED','RETIRED')),
  last_success_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reality_data_coverage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adapter_id uuid NOT NULL REFERENCES public.reality_source_adapters(id),
  geography_type text NOT NULL,
  geography_key text NOT NULL,
  domain text NOT NULL,
  period_start timestamptz,
  period_end timestamptz,
  availability_status text NOT NULL
    CHECK (availability_status IN ('AVAILABLE','PARTIAL','MISSING','UNKNOWN')),
  provenance_quality numeric CHECK (provenance_quality IS NULL OR (provenance_quality >= 0 AND provenance_quality <= 1)),
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(adapter_id,geography_type,geography_key,domain,period_start,period_end)
);

ALTER TABLE public.reality_source_adapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reality_data_coverage ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.reality_source_adapters FROM anon;
REVOKE ALL ON public.reality_data_coverage FROM anon;
GRANT SELECT ON public.reality_source_adapters, public.reality_data_coverage TO authenticated;
GRANT INSERT,SELECT,REFERENCES,TRIGGER ON public.reality_source_adapters,public.reality_data_coverage TO service_role;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES ON public.reality_source_adapters,public.reality_data_coverage FROM authenticated;
REVOKE UPDATE,DELETE,TRUNCATE ON public.reality_source_adapters,public.reality_data_coverage FROM service_role;

DROP POLICY IF EXISTS "authenticated read source adapters" ON public.reality_source_adapters;
CREATE POLICY "authenticated read source adapters" ON public.reality_source_adapters FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated read data coverage" ON public.reality_data_coverage;
CREATE POLICY "authenticated read data coverage" ON public.reality_data_coverage FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.forbid_future_os_source_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Future OS source history is immutable: % is not allowed on %', TG_OP, TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS reality_source_adapters_no_update ON public.reality_source_adapters;
CREATE TRIGGER reality_source_adapters_no_update BEFORE UPDATE ON public.reality_source_adapters FOR EACH ROW EXECUTE FUNCTION public.forbid_future_os_source_mutation();
DROP TRIGGER IF EXISTS reality_source_adapters_no_delete ON public.reality_source_adapters;
CREATE TRIGGER reality_source_adapters_no_delete BEFORE DELETE ON public.reality_source_adapters FOR EACH ROW EXECUTE FUNCTION public.forbid_future_os_source_mutation();
DROP TRIGGER IF EXISTS reality_data_coverage_no_update ON public.reality_data_coverage;
CREATE TRIGGER reality_data_coverage_no_update BEFORE UPDATE ON public.reality_data_coverage FOR EACH ROW EXECUTE FUNCTION public.forbid_future_os_source_mutation();
DROP TRIGGER IF EXISTS reality_data_coverage_no_delete ON public.reality_data_coverage;
CREATE TRIGGER reality_data_coverage_no_delete BEFORE DELETE ON public.reality_data_coverage FOR EACH ROW EXECUTE FUNCTION public.forbid_future_os_source_mutation();

INSERT INTO public.reality_source_adapters
(adapter_key,source_name,publisher,canonical_url,access_protocol,data_domains,geography_scopes,frequencies,latency_class,historical_start,revision_policy,publication_timestamp_available,point_in_time_safe,reliability,independence_group,status,metadata)
VALUES
('oecd-housing-sdmx','OECD Housing Prices','OECD','https://www.oecd.org/en/data/indicators/housing-prices.html','SDMX-REST','["prices","rents","affordability"]','["global","country"]','["monthly","quarterly","annual"]','QUARTERLY','1990','provider revisions; must preserve retrieved_at and publication metadata',true,false,0.95,'oecd','PLANNED','{"reason":"official analytical housing indicators"}'),
('bis-rpp','BIS Residential Property Prices','BIS','https://data.bis.org/topics/RPP','SDMX/BULK','["prices","real_prices","nominal_prices","regional_prices"]','["global","country","selected_subnational"]','["monthly","quarterly","annual"]','MONTHLY','1970','provider revisions and back-calculations; immutable ingestion required',true,false,0.98,'bis','PLANNED','{"coverage":"~60 economies"}'),
('eurostat-prc-hpi-q','Eurostat prc_hpi_q','Eurostat','https://ec.europa.eu/eurostat/databrowser/view/prc_hpi_q/default/table','EUROSTAT-API','["house_prices"]','["europe","country"]','["quarterly"]','QUARTERLY','2005','provider revisions; flags preserved',true,false,0.97,'eurostat','PLANNED','{"dataset":"prc_hpi_q"}'),
('csu-datastat','DataStat','ČSÚ','https://csu.gov.cz/datastat','API','["prices","demography","construction","income","employment"]','["czechia","region","municipality"]','["monthly","quarterly","annual"]','MONTHLY','provider_defined','preserve source publication/revision metadata',true,false,0.98,'csu','PLANNED','{}'),
('cnb-arad','ARAD','ČNB','https://www.cnb.cz/en/statistics/arad/','API/EXPORT','["rates","mortgages","credit","macro_finance"]','["czechia"]','["daily","monthly","quarterly"]','MONTHLY','provider_defined','preserve release/revision metadata',true,false,0.98,'cnb','PLANNED','{}'),
('google-trends-alpha','Google Trends API','Google','https://developers.google.com/search/apis/trends','API','["search_interest","behavior"]','["global","country","region","city"]','["daily","weekly"]','DAILY','provider_defined','availability and query methodology must be stored with observation',true,false,0.90,'google-trends','PLANNED','{"access":"alpha"}'),
('gdelt-events','GDELT','GDELT Project','https://www.gdeltproject.org/','API','["news","events","sentiment","geopolitics"]','["global","country","region"]','["15m","daily"]','INTRADAY','2015','event revisions/deletions must be append-only',true,false,0.75,'gdelt','PLANNED','{"role":"behavioral/context signal, not direct price truth"}'),
('openstreetmap','OpenStreetMap','OpenStreetMap Foundation','https://www.openstreetmap.org/','API/DIFF','["infrastructure","places","roads","amenities"]','["global","country","region","city","micro-market"]','["continuous","daily"]','DAILY','provider_defined','use versioned extracts/diffs when historical reconstruction is required',false,false,0.90,'osm','PLANNED','{"role":"spatial context"}')
ON CONFLICT (adapter_key) DO NOTHING;
