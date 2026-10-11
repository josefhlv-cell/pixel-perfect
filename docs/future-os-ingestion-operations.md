# Future OS ingestion operations

## What runs

The authenticated server route `POST /api/public/cron/future-os-ingestion` runs the current configured adapters independently:

- Eurostat quarterly house-price index (`prc_hpi_q`, Czechia).
- BIS residential property prices (`WS_SPP`, Czechia).
- ČNB ARAD sets configured by `DEFAULT_SET_IDS` in `src/lib/future-os/adapters/cnb-arad.server.ts`.

A source can fail while others succeed. Inspect the JSON response, server log event `[future-os-ingestion]`, and append-only rows written to `reality_data_coverage`; do not interpret HTTP 200 as proof every source succeeded. The coverage ledger records per-source/set attempt timestamps, counts, status, and any error when that write succeeds. The route returns 502 only when every attempted source reports an error.

## Schedule activation is an explicit deployment step

Migration `0011_future_os_ingestion_scheduler.sql` defines an opt-in daily pg_cron job at 02:20 UTC. Applying the migration alone does **not** schedule the job. After the route is deployed and the secret is configured:

1. Confirm `LOVABLE_CRON_SECRET` is configured for the deployed server and is at least 32 characters. The route accepts the configured current/previous cron secret through the existing shared authentication helper.
2. Confirm pg_cron and pg_net are installed and the `sandbox_exec` role exists in the target database.
3. Confirm the URL in the migration matches the actual deployed app URL.
4. Have an authorized operator invoke `public.schedule_future_os_ingestion(secret)` using the same cron secret through a secure database session or approved secret-injection mechanism. Do not commit, log, or paste the secret into tickets.
5. Verify the job in `cron.job`, then verify execution and HTTP response in `cron.job_run_details` and application logs.

Never activate this job before the route is deployed and authentication is configured. To stop it, remove the `future-os-ingestion-daily` job through an authorized database session. Rotation should update the app secret and reschedule the job as one controlled operation.

## Data semantics and limitations

- `available_at` is a conservative retrieval cutoff when the provider does not expose a verified release timestamp. It is not a claim about the exact publication time.
- Daily polling does not turn quarterly source series into daily observations.
- Current API responses are not equivalent to a complete archive of historical publisher vintages. Do not use them to claim leak-free historical forecasts unless vintage availability is independently established.
- Source reliability metadata is configuration, not a statistically validated probability that an observation is correct.
- BIS / Eurostat / ARAD failures are isolated per source or set. Check each result's `error`, `fetched`, `inserted`, `unchanged`/ `skipped`, and `revised` counts.
- ARAD requires server-side `CNB_ARAD_API_KEY`. If missing, each configured set reports an error; do not mark ČNB ingestion active until a real successful run is verified.
- The scheduler's cron job and the endpoint's successful execution are separate states. Neither is asserted as active by source code alone.

## Recovery

1. Inspect the last cron job execution and the `[future-os-ingestion]` log event.
2. Retry only after correcting upstream/network/credential/database failures.
3. The evidence pipeline is append-only; avoid manual updates/deletes. Check adapter-specific duplicate and revision behavior before retrying a partially completed run.
4. Confirm new records' source, `retrieved_at`, `available_at`, content hash, and revision/supersedes linkage.
5. If the deployment URL, route, auth secret, or adapter key changes, update the scheduler/configuration and test an authenticated manual POST before rescheduling.

## Safe rollout / rollback

- Deploy application code first; apply database migrations only through the project's approved migration process.
- Verify authentication rejects requests without a valid Bearer secret.
- Verify each adapter independently with a controlled manual run and inspect the result.
- Only then activate the pg_cron job.
- Roll back by unscheduling the job first, then revert the application/migration through the normal migration policy. Do not delete evidence history to roll back code.
