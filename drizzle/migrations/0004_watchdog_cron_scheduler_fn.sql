CREATE OR REPLACE FUNCTION public.schedule_watchdog_cron(_secret text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, cron AS $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'watchdog-daily';
  PERFORM cron.schedule('watchdog-daily', '0 * * * *', format(
    $c$select net.http_post(url:='https://project--9ec4accc-42fa-473d-b423-03251a087cef.lovable.app/api/public/cron/watchdog', headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'), body:='{}'::jsonb, timeout_milliseconds:=600000)$c$, _secret));
END $$;
REVOKE ALL ON FUNCTION public.schedule_watchdog_cron(text) FROM PUBLIC, anon, authenticated;