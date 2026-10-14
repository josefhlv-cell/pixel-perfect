# Forecasting research and evaluation protocol

This project treats a forecast as a time-stamped probability distribution conditional on information available at issuance. The objective is measurable decision value, not confident prose or an untestable claim of foresight.

## Research foundations

- Hyndman & Athanasopoulos, *Forecasting: Principles and Practice*, time-series cross-validation: https://otexts.com/fpp3/tscv.html
- Gneiting & Raftery (2007), *Strictly Proper Scoring Rules, Prediction, and Estimation*: https://doi.org/10.1198/016214506000001437
- Xu & Xie (2023), *Sequential Predictive Conformal Inference for Time Series*: https://proceedings.mlr.press/v202/xu23r.html
- Makridakis et al., M4 forecasting competition: https://doi.org/10.1016/j.ijforecast.2018.06.001
- NIST/SEMATECH e-Handbook of Statistical Methods: https://www.itl.nist.gov/div898/handbook/

## Mandatory protocol

1. **Point-in-time features:** use release/availability timestamps, not just observation dates. Never use later revisions before their release.
2. **Rolling-origin evaluation:** each forecast is produced using only the past; keep a locked chronological holdout.
3. **Benchmarks:** compare with no-change, seasonal-naive where appropriate, and simple regularized economic baselines.
4. **Separate target and horizon:** report metrics by geography, target, forecast horizon, and market regime. Aggregates must not conceal local failures.
5. **Probabilistic quality:** report MAE and bias for point forecasts; Brier and log loss for binary events; interval coverage, width and interval score for quantiles; reliability bins for calibration.
6. **Sample sufficiency:** publish sample count and a distinct insufficient-evidence status. Avoid performance claims when sample sizes are small.
7. **Model selection discipline:** tune only on validation periods; use the final chronological test once; correct for multiple testing when exploring many signals.
8. **Regime shifts:** detect and report distribution changes; lower trust and widen uncertainty rather than assuming a particular market direction.
9. **Source lineage:** retain publisher, series identifier, units, geography, observed period, publication time, retrieval time, revision/version, hash, and license.
10. **Decision relevance:** evaluate expected rent, vacancy, operating costs, financing, taxes, liquidity and downside scenarios; keep assumptions editable and explicit.

## Why astrophysics is not a default property predictor

Astrophysical cycles can be studied as exploratory hypotheses, but there is no established causal basis to treat them as predictive inputs for local property prices. Only consider them if a preregistered mechanism and prospective out-of-sample tests demonstrate incremental skill after controlling for ordinary macroeconomic predictors and correcting for multiple comparisons. Otherwise exclude them from decision models.

## Operational status

The modules in this directory provide evaluation/calibration primitives. Do not describe them as production-connected until the forecast persistence and ingestion paths call them, data lineage is verified, and tests/build pass in CI. A score is not proof of causality, and calibrated intervals under exchangeability do not guarantee coverage during structural market breaks.
