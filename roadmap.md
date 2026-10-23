- [x] Firecrawl: more pages per search (24), Bazoš/Sbazar/Annonce, Facebook via open web
- [x] ČNB ARAD import into point-in-time evidence
- [ ] Higher Firecrawl plan — user upgrades on firecrawl.dev

## PR sync (main)
- [x] #4 calculator metrics in main
- [x] #9 identical to main (DB application unverified, schedule not enabled)
- [x] #6 ported: probabilistic-metrics, temporal-calibration, INSUFFICIENT_DATA health guard, trust cap, radar DATA_STARVED, forecast-memory NaN guards
- [x] #6 forecast.ts / forecast-evaluation.ts — interval calibration, finite samples, no credit for a flat direction
- [x] #3, #5 superseded — ČNB adapter is on main; old server file is not restored
- [ ] #2 → #8, #1 — do not merge wholesale; split review incl. migrations/RLS
- [x] #2 part 1: walk-forward runner, prediction journal, runner state, experiment config/integrity, trajectory graph, vintage as-of/audit/snapshot, backtest metrics (pure, tested)
- [ ] #2 rest: baseline-forecast(s) (strict-type fixes), house-price server fn + UI, dashboard/market edits, migrations
- [ ] Real-data walk-forward backtest vs naive baseline (needs evidence history with vintages)

## Earlier requests (done)
- [x] Live-only database reads; hide demo data; 220/220 tests, build OK
- [x] 7 critical permissive read-policy findings fixed via migration
- [x] Plain-Czech UI pass; 11 authenticated pages verified; 216/216 tests, lint 0 errors

## Current request: FINAL AUDIT & COMPLETION (uploaded spec)
- [ ] Audit: map where valuation/rent/calculation engines are used (UI, API, AI); find divergent or stale logic
- [ ] Wire rent comparables model (rent-model.ts) into the real data flow or document the blocker (no rental listings source)
- [ ] Verify UI null/empty handling for estimates (no zero-as-estimate, no false deal score)
- [ ] Verify consistency: same engine in UI, API, AI
- [ ] Add/repair tests for: insufficient comparables, outliers, duplicates, stale data, rent vs services separation, null handling
- [ ] Run tests, lint, typecheck, production build; record real results
- [ ] Final summary: changes, files, checks, remaining blockers, live-data status, deploy readiness
