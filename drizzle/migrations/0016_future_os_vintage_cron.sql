-- Schedule authenticated source snapshot collection daily; HPI is a low-frequency quarterly series.
-- Call once after deployment with the public app URL and the same cron secret
-- configured for authenticateCronRequest. Do not use a preview URL in production.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.schedule_future_os_vintage_ingestion(_base_url text, _secret text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, cron, net
AS $$
DECLARE
  normalized_url text;
BEGIN
  normalized_url := rtrim(_base_url, '/');
  IF normalized_url !~ '^https://[^[:space:]]+$' THEN
    RAISE EXCEPTION 'A valid HTTPS application base URL is required';
  END IF;
  IF _secret IS NULL OR length(_secret) < 24 THEN
    RAISE EXCEPTION 'A cron secret of at least 24 characters is required';
  END IF;

  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'future-os-vintage-ingestion';

  PERFORM cron.schedule(
    'future-os-vintage-ingestion',
    '15 3 * * *',
    format(
      $job$SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','Authorization',%L),
        body := '{}'::jsonb,
        timeout_milliseconds := 600000
      )$job$,
      normalized_url || '/api/public/cron/future-os-vintages',
      'Bearer ' || _secret
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_future_os_vintage_ingestion(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_future_os_vintage_ingestion(text,text) TO sandbox_exec;
