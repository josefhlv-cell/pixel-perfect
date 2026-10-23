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
- [x] Audit: single engine confirmed (deals.ts/valuation.ts/calculations) shared by UI, AI and API; no divergent math
- [x] Rent model wired: listings.offer_type (migration 0017), extraction distinguishes prodej/pronajem, monthly_rent without services, rental comparables feed estimateRentFromComparables in enrichListing (UI + AI)
- [x] Sale pool excludes rentals; rental listings are not sale targets (no benchmark/yield/cash-flow on them)
- [x] Deal score capped at 20 without any financial evidence; priorityBreakdown mirrors the cap
- [x] UI null fixes: portfolio-import rent no longer defaults to 0 (save blocked without real rent), cash-flow tone no longer treats null as positive, market bar chart skips missing cities, rental cards show "Nájem za měsíc" instead of "Cena"
- [x] Tests added (webagent offer_type/rent, rental pool, rent estimate wiring, score cap): 240/240 pass, tsgo clean, lint 0 errors/9 pre-existing warnings, production build OK
- [x] Authenticated browser check: /deals (33 live listings) + detail — no console errors, missing rent shows "Neuvedeno" with explanation
- [ ] Live rental search to populate rental comparables (user runs e.g. "pronájem 2+kk Pardubice" in Deal Hunter; costs Firecrawl/AI credits)
- [ ] Publication of these changes — awaiting user approval
