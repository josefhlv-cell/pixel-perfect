-- Enforce outcome timing at the database boundary.
-- A score cannot be inserted before the forecast's declared horizon has elapsed.
CREATE OR REPLACE FUNCTION public.guard_future_os_forecast_outcome_timing()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  forecast_cutoff timestamptz;
  forecast_horizon integer;
BEGIN
  SELECT data_cutoff, horizon_days
    INTO forecast_cutoff, forecast_horizon
  FROM public.reality_forecast_runs
  WHERE id = NEW.forecast_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Forecast % does not exist', NEW.forecast_id;
  END IF;

  IF NEW.outcome_as_of < forecast_cutoff + make_interval(days => forecast_horizon) THEN
    RAISE EXCEPTION
      'Forecast outcome is premature: outcome_as_of % precedes required horizon end %',
      NEW.outcome_as_of,
      forecast_cutoff + make_interval(days => forecast_horizon);
  END IF;

  IF NEW.outcome_as_of > now() THEN
    RAISE EXCEPTION 'Forecast outcome cannot be available in the future';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reality_forecast_outcome_timing_guard
  ON public.reality_forecast_outcomes;
CREATE TRIGGER reality_forecast_outcome_timing_guard
  BEFORE INSERT OR UPDATE ON public.reality_forecast_outcomes
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_future_os_forecast_outcome_timing();

REVOKE ALL ON FUNCTION public.guard_future_os_forecast_outcome_timing()
  FROM PUBLIC, anon, authenticated;
