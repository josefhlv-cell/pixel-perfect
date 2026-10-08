# ČNB ARAD integration

The ARAD adapter is server-only. It fetches the official CSV export and appends parsed numeric observations to the Future OS immutable evidence ledger.

## Configuration

Set `CNB_ARAD_API_KEY` in the server runtime's environment/secrets. Do not use a `VITE_` prefix and do not commit a real key to Git. Add it to local `.env` (which must remain ignored) for local development.

## Calling the sync

Import `syncCnbAradData` from `src/lib/cnb-arad.functions.ts` in a server-aware TanStack Start route or admin action. The function requires the signed-in Supabase user and accepts an optional `setIds` array. By default it requests ARAD sets `1045, 1119, 1132, 1035, 1028`.

The result reports fetched rows, inserted observations, skipped rows, retrieval time, and set IDs. It fails closed if the API key is missing, the request fails, the export is empty, or no numeric values can be identified.

## Data integrity

- API credentials stay on the server.
- `available_at` and `retrieved_at` are the time of ingestion; the provider's period is kept separately as `observed_at` / `effective_from`.
- Original row fields and raw values are preserved in the observation JSON.
- Content hashes and the evidence table's unique key make repeated imports idempotent.
- Values are not treated as leading indicators automatically; `lead_class` remains `UNKNOWN`.
- ARAD CSV column labels can vary by set. Verify the returned header mapping and units for each selected set before using imported values in production forecasts.

## Deployment checklist

1. Apply the existing Future OS evidence foundation migrations (including `0006`, `0008`, `0009`, and `0010`) to the target Supabase database.
2. Configure `CNB_ARAD_API_KEY` in the server deployment environment.
3. Run `npm test -- src/lib/cnb-arad.server.test.ts`.
4. Call the authenticated sync and inspect the returned counts and a sample of the stored evidence rows.
5. Keep adapter status `PLANNED` until a successful real API sync and schema/units review have been completed.
