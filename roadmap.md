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

## Current request: production-only data
- [ ] Hide demo data across lists, market, AI and related reads without deleting history.
- [ ] Verify authenticated preview and publish; confirm live availability.
