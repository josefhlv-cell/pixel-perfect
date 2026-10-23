-- Rental comparables: evidence-backed rent model inputs.
-- Safe to commit before deployment: this file does not alter a live database by itself.
CREATE TABLE IF NOT EXISTS public.rental_comparables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url text NOT NULL,
  source_domain text NOT NULL,
  external_id text,
  dedupe_key text NOT NULL,
  city text NOT NULL,
  district text,
  latitude double precision,
  longitude double precision,
  disposition text NOT NULL,
  area_m2 numeric NOT NULL CHECK (area_m2 > 0 AND area_m2 <= 1000),
  monthly_rent_czk integer NOT NULL CHECK (monthly_rent_czk > 0),
  monthly_services_czk integer CHECK (monthly_services_czk IS NULL OR monthly_services_czk >= 0),
  monthly_energy_czk integer CHECK (monthly_energy_czk IS NULL OR monthly_energy_czk >= 0),
  condition text,
  furnishing text,
  floor integer,
  floor_count integer,
  elevator boolean,
  parking boolean,
  storage boolean,
  balcony boolean,
  building_year integer CHECK (building_year IS NULL OR building_year BETWEEN 1800 AND 2100),
  published_at timestamptz,
  observed_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  is_verified boolean NOT NULL DEFAULT false,
  is_sample boolean NOT NULL DEFAULT false,
  raw_features jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dedupe_key, observed_at)
);

CREATE INDEX IF NOT EXISTS rental_comparables_geo_layout_idx
  ON public.rental_comparables (city, disposition, area_m2)
  WHERE is_active = true AND is_sample = false;
CREATE INDEX IF NOT EXISTS rental_comparables_observed_idx
  ON public.rental_comparables (observed_at DESC);
CREATE INDEX IF NOT EXISTS rental_comparables_dedupe_idx
  ON public.rental_comparables (dedupe_key);

ALTER TABLE public.rental_comparables ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.rental_comparables TO authenticated;
GRANT ALL ON public.rental_comparables TO service_role;
DROP POLICY IF EXISTS "authenticated read rental comparables" ON public.rental_comparables;
CREATE POLICY "authenticated read rental comparables"
  ON public.rental_comparables FOR SELECT TO authenticated USING (true);

-- Deliberately no INSERT/UPDATE/DELETE grant or policy for authenticated users.
-- Ingestion must use a server-side service-role client and validate source provenance.
