-- Future OS scheduled ingestion. Creating this function does not activate the job;
-- an operator with the deployment secret must invoke it after the route is deployed.
CREATE OR REPLACE FUNCTION public.schedule_future_os_ingestion(_secret text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, net
AS $$
BEGIN
  IF _secret IS NULL OR length(_secret) < 32 THEN
    RAISE EXCEPTION 'A cron secret of at least 32 characters is required';
  END IF;

  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'future-os-ingestion-daily';

  PERFORM cron.schedule(
    'future-os-ingestion-daily',
    '20 2 * * *',
    format(
      'select net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', %L), body := ''{}''::jsonb, timeout_milliseconds := 600000)',
      'https://project--9ec4accc-42fa-473d-b423-03251a087cef.lovable.app/api/public/cron/future-os-ingestion',
      'Bearer ' || _secret
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_future_os_ingestion(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_future_os_ingestion(text)
  TO sandbox_exec;
