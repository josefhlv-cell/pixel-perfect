DROP POLICY IF EXISTS "authenticated read source adapters" ON public.reality_source_adapters;
DROP POLICY IF EXISTS "authenticated read lead tests" ON public.reality_signal_lead_tests;
DROP POLICY IF EXISTS "authenticated read signal observations" ON public.reality_signal_observations;
DROP POLICY IF EXISTS "authenticated read world state snapshots" ON public.reality_world_state_snapshots;
DROP POLICY IF EXISTS "authenticated read model champions" ON public.reality_model_champions;
DROP POLICY IF EXISTS "authenticated read model evaluations" ON public.reality_model_evaluations;
DROP POLICY IF EXISTS "authenticated read model candidates" ON public.reality_model_candidates;
REVOKE ALL ON public.reality_source_adapters, public.reality_signal_lead_tests, public.reality_signal_observations, public.reality_world_state_snapshots, public.reality_model_champions, public.reality_model_evaluations, public.reality_model_candidates FROM anon, authenticated;
GRANT ALL ON public.reality_source_adapters, public.reality_signal_lead_tests, public.reality_signal_observations, public.reality_world_state_snapshots, public.reality_model_champions, public.reality_model_evaluations, public.reality_model_candidates TO service_role;