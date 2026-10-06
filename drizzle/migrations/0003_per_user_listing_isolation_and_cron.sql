CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_source_url_key;
CREATE UNIQUE INDEX IF NOT EXISTS listings_owner_source_url_key ON public.listings (COALESCE(created_by, '00000000-0000-0000-0000-000000000000'::uuid), source_url);
CREATE INDEX IF NOT EXISTS listings_created_by_idx ON public.listings (created_by);
CREATE INDEX IF NOT EXISTS properties_created_by_idx ON public.properties (created_by);

DROP POLICY IF EXISTS "authenticated read" ON public.listings;
CREATE POLICY "own or sample listings read" ON public.listings FOR SELECT TO authenticated
  USING (is_sample OR created_by = auth.uid());

DROP POLICY IF EXISTS "authenticated read" ON public.properties;
CREATE POLICY "own or sample properties read" ON public.properties FOR SELECT TO authenticated
  USING (is_sample OR created_by = auth.uid());

DROP POLICY IF EXISTS "authenticated read" ON public.listing_snapshots;
CREATE POLICY "visible listing snapshots read" ON public.listing_snapshots FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND (l.is_sample OR l.created_by = auth.uid())));

DROP POLICY IF EXISTS "authenticated read" ON public.listing_freshness_events;
CREATE POLICY "visible freshness events read" ON public.listing_freshness_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND (l.is_sample OR l.created_by = auth.uid())));

DROP POLICY IF EXISTS "authenticated read" ON public.property_snapshots;
CREATE POLICY "visible property snapshots read" ON public.property_snapshots FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND (p.is_sample OR p.created_by = auth.uid())));

DROP POLICY IF EXISTS "authenticated read" ON public.property_valuations;
CREATE POLICY "visible valuations read" ON public.property_valuations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND (p.is_sample OR p.created_by = auth.uid())));

DROP POLICY IF EXISTS "authenticated read" ON public.rent_estimates;
CREATE POLICY "visible rent estimates read" ON public.rent_estimates FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND (p.is_sample OR p.created_by = auth.uid())));

DROP POLICY IF EXISTS "authenticated read" ON public.market_comparables;
CREATE POLICY "visible comparables read" ON public.market_comparables FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND (p.is_sample OR p.created_by = auth.uid())));