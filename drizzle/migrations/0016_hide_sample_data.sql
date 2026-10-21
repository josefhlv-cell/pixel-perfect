-- Live mode: authenticated clients no longer read demo rows.
-- The rows stay in place, so the switch is reversible and nothing is destroyed.
-- service_role bypasses RLS and can still see them for audit.

DROP POLICY IF EXISTS "own or sample listings read" ON public.listings;
CREATE POLICY "own live listings read" ON public.listings
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() AND is_sample = false);

DROP POLICY IF EXISTS "own or sample properties read" ON public.properties;
CREATE POLICY "own live properties read" ON public.properties
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() AND is_sample = false);

DROP POLICY IF EXISTS "visible listing snapshots read" ON public.listing_snapshots;
CREATE POLICY "visible listing snapshots read" ON public.listing_snapshots
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.listings l
    WHERE l.id = listing_id AND l.created_by = auth.uid() AND l.is_sample = false
  ));

DROP POLICY IF EXISTS "visible freshness events read" ON public.listing_freshness_events;
CREATE POLICY "visible freshness events read" ON public.listing_freshness_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.listings l
    WHERE l.id = listing_id AND l.created_by = auth.uid() AND l.is_sample = false
  ));

DROP POLICY IF EXISTS "visible property snapshots read" ON public.property_snapshots;
CREATE POLICY "visible property snapshots read" ON public.property_snapshots
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = property_id AND p.created_by = auth.uid() AND p.is_sample = false
  ));

DROP POLICY IF EXISTS "visible valuations read" ON public.property_valuations;
CREATE POLICY "visible valuations read" ON public.property_valuations
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = property_id AND p.created_by = auth.uid() AND p.is_sample = false
  ));

DROP POLICY IF EXISTS "visible rent estimates read" ON public.rent_estimates;
CREATE POLICY "visible rent estimates read" ON public.rent_estimates
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = property_id AND p.created_by = auth.uid() AND p.is_sample = false
  ));

DROP POLICY IF EXISTS "visible comparables read" ON public.market_comparables;
CREATE POLICY "visible comparables read" ON public.market_comparables
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = property_id AND p.created_by = auth.uid() AND p.is_sample = false
  ));

DROP POLICY IF EXISTS "authenticated read" ON public.market_statistics;
CREATE POLICY "live market statistics read" ON public.market_statistics
  FOR SELECT TO authenticated
  USING (is_sample = false);
