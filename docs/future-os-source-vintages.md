# Future OS source-vintage collection

## What this collects

The authenticated endpoint `POST /api/public/cron/future-os-vintages` fetches Czech quarterly HPI from Eurostat and appends deterministic SHA-256 identified retrieval snapshots to `public.reality_source_vintages`.

A snapshot means **the value this application retrieved at that timestamp**. It is not a publisher-provided historic vintage. Eurostat's current endpoint returns a current series that can contain revisions; this collector cannot reconstruct what Eurostat published years ago.

## Deployment checklist

1. Reconcile this feature branch with the current production branch before merging; the Future OS branch history is currently diverged.
2. Confirm migrations `0015_future_os_source_vintages.sql` and `0016_future_os_vintage_cron.sql` are present in the correct migration order and that the Drizzle journal matches.
3. Deploy the application with `LOVABLE_CRON_SECRET` configured to a high-entropy value of at least 24 characters.
4. Apply migrations to a staging database first. Verify RLS, service-role insert access, and append-only mutation triggers.
5. Once deployed at the stable production HTTPS URL, invoke the scheduling function once with the same secret as the application's cron authentication setting:

   ```sql
   select public.schedule_future_os_vintage_ingestion(
     'https://YOUR-PRODUCTION-HOST',
     'YOUR-LOVABLE-CRON-SECRET'
   );
   ```

   Run this only through an authorized administrative database session. The scheduling function stores the bearer secret in the `pg_cron` job command, following the repository's existing scheduler pattern; restrict access to scheduler metadata and rotate the secret if exposed. Never commit the real secret.

6. Verify the job exists in `cron.job`, inspect HTTP outcomes from `net._http_response` where supported, and confirm new rows arrive in `reality_source_vintages`.
7. Run `bun run lint`, `bun run test`, and `bun run build`; test the migration against a disposable database before production.

## Interpretation and modeling rules

- Keep the `quality` value `RETRIEVAL_SNAPSHOT` for this adapter.
- Never label a row `OBSERVED_VINTAGE` unless the source supplies authentic publication-time and revision metadata for that particular observation.
- A historical as-of reconstruction may only use snapshots whose `retrieved_at` is at or before the requested cutoff.
- Do not claim verified historical forecast skill until enough prospective data has accumulated and a chronological, leakage-free evaluation has been run.
- Do not count repeated identical hourly snapshots as independent forecast origins. Choose origins based on a predeclared cadence or meaningful source updates, and report effective sample size.
- Model promotion must remain disabled for assumed publication lags or latest-revision backtests.

## Next milestones

1. Add adapters and archive snapshots for leading indicators (rates, permits, completions, rents, migration, transaction volume) with source-specific units, geographic coverage and release-lag metadata.
2. Add an explicit collection-run ledger, freshness/coverage metrics, source outage alerts, and deduplication policy.
3. Build walk-forward evaluation from archived retrievals with a minimum sample count, benchmark comparisons, interval calibration and results by horizon/region/regime.
4. Use a champion/challenger tournament with frozen holdout windows and human-approved promotion.
