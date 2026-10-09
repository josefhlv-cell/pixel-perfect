# Reality Investor — Future OS

## Mission

Future OS is not a price guessing feature. It is a probabilistic, point-in-time model of the real-estate world that can be falsified by historical out-of-sample testing.

The system must distinguish **what happened** from **what was knowable at the time**.

## 1. Epistemic time model

Every evidence observation has separate clocks:

- **observed_at** — when the underlying phenomenon was measured or occurred.
- **published_at** — when the source published the information.
- **retrieved_at** — when Reality Investor obtained it.
- **available_at** — the authoritative information-availability timestamp used by historical models.
- **effective_from / effective_to** — the period to which the value applies.
- **revision** — revision/version of the same economic series.

A historical forecast at cutoff T may only use evidence with available_at <= T.

Event time alone is never sufficient.

## 2. No-look-ahead rule

A model is forbidden from reading any observation whose available_at is after its forecast cutoff.

Later revisions are append-only observations. They never overwrite earlier observations.

Therefore a 2019 backtest must see the information set a model could have had in 2019, not today's revised 2019 data.

## 3. Evidence Universe

reality_evidence_sources stores provenance and source independence.

reality_evidence stores immutable observations.

Important fields:

- source / publisher
- source URL
- geography hierarchy
- entity / series
- event time
- information-availability time
- revision
- value
- unit / frequency
- leading / coincident / lagging classification
- reliability
- independence group
- content hash
- revision lineage

Ten articles repeating the same wire story are not ten independent pieces of evidence. Independence is tracked explicitly.

## 4. World State

reality_world_state_snapshots represents a reconstructed state of a geography at a historical cutoff.

Hierarchy:

WORLD → EUROPE → COUNTRY → REGION → CITY → DISTRICT → MICRO-MARKET → PROPERTY

A national signal must never automatically become a property-level prediction.

## 5. Existing system remains intact

The Future OS layer sits beside the existing:

- Deal Hunter
- Web Agent
- Firecrawl
- listing snapshots
- freshness / watchdog
- market statistics
- Deal Priority
- AI analysis
- map
- portfolio

Future OS is the epistemic layer that later consumes these signals rather than replacing them.

## 6. External source adapter contract

Future adapters should normalize sources such as:

- OECD housing
- BIS residential property prices
- Eurostat
- ČSÚ
- ČNB
- RÚIAN / ČÚZK
- building permits and construction
- migration / demographics
- rents
- listings and listing changes
- search interest
- infrastructure and planning

Adapters must preserve publication/retrieval timestamps and must never invent missing historical provenance.

## 7. Future modules

### Causal Engine
Represent mechanisms such as:

rates → mortgage credit → purchasing power → demand → inventory/liquidity → transactions → prices

and estimate lag distributions rather than assuming instant effects.

### Competing Futures
Maintain multiple regimes simultaneously:

EXPANSION / RECOVERY / SOFT LANDING / DECELERATION / CORRECTION / LIQUIDITY CRISIS

If posterior probabilities are too close, output CONTESTED.

### Model Tournament
Compare baselines, momentum, mean-reversion, boosting, spatial, temporal, macro, connected-market, ensemble and structural/digital-twin candidates.

Champion selection is conditional on geography, horizon, regime, data volume and drift.

### Drift Detection
Track changes in distributions, volatility, liquidity, model disagreement and forecast error. A regime break can demote a previously strong model.

### Historical Time Machine
Reconstruct the information set at a historical date, generate the forecast, then reveal subsequent truth step by step.

Required metrics include MAE, RMSE, directional accuracy, interval coverage, Brier/log loss, lead time, regret and decision utility.

### Falsification
Every important mechanism gets a kill test. If evidence repeatedly contradicts a mechanism, confidence and trust limits decrease.

### Future Market Twin
Run controlled counterfactual shocks:

- rates ±1pp
- credit tightening / easing
- supply shocks
- migration shocks
- unemployment changes
- infrastructure changes
- combinations

Output a probability distribution over futures, not a single deterministic future.

### Next Best Observation
When uncertainty is high, calculate which missing observation has the highest expected information value after accounting for reliability, cost, latency and ability to distinguish competing hypotheses.

The correct output can be:

I don't know. The next most valuable information is X.

## 8. Scientific claim

The product must never claim to literally see the future.

The stronger claim must be earned empirically:

1. point-in-time data
2. historical reconstruction
3. strict out-of-sample forecasts
4. baseline comparison
5. calibration
6. drift monitoring
7. falsification
8. repeated performance across geographies and regimes

Only then can Reality Investor demonstrate that particular signals and models provide useful predictive lead time.

## 9. Data quality principle

Missing provenance is not silently converted into confidence.

Unknown stays unknown.

READY, LIMITED and DATA_STARVED are explicit states.

## 10. Design direction

The long-term product is a Future Radar:

CURRENT STATE
→ LEADING SIGNALS
→ CAUSAL CHAIN
→ COMPETING FUTURES
→ MODEL AGREEMENT
→ MARKET TWIN
→ DRIFT
→ UNCERTAINTY
→ NEXT BEST OBSERVATION

The system should continuously ask not only:

"What will happen?"

but also:

"Why do we believe it, what would disprove it, what did we know at the time, and what information should we obtain next?"

## ČNB ARAD adapter (live)
- Endpoints: `/aradb/api/v1/indicators` (metadata: frequency, unit) + `/aradb/api/v1/data` (indicator_id;snapshot_id;period;value), `set_id` required, windows-1250 body.
- Secret `CNB_ARAD_API_KEY` is read server-side only; the stored `source_url` never contains the key.
- `available_at = retrieved_at = import time`; `published_at = NULL` (ARAD gives none); `observed_at = effective_from = period date`; `frequency`/`unit` only from provider metadata; `lead_class = UNKNOWN`.
- Same indicator+period+hash → skipped; same indicator+period with a changed value → new row with `revision+1`, `supersedes_id` → old truth stays queryable.
- Rows without a parseable period or numeric value are not stored.
