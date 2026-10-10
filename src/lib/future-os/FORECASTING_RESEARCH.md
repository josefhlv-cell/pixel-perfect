# Forecasting research and implementation principles

This project aims to make probabilistic real-estate forecasts auditable and empirically useful. A forecast is a distribution plus a decision horizon, data cutoff, and explicit uncertainty—not a promise to know the future.

## Methods mapped to engineering choices

### 1. Rolling-origin evaluation and point-in-time data

Evaluate forecasts in chronological order. At each origin, only use features and revisions that would have been available at that time; evaluate separately by target horizon. Random train/test splits can leak future information into time-series estimates.

Reference: Hyndman and Athanasopoulos, *Forecasting: Principles and Practice*, section on time-series cross-validation: https://otexts.com/fpp3/tscv.html

### 2. Strictly proper scores for probabilities

For binary events, Brier score and log loss reward honest probability estimates in expectation. For distributions and quantiles, add interval score or weighted interval score; never judge a probabilistic model only by point error or whether one outcome happened to land inside an interval.

Reference: Gneiting and Raftery (2007), *Strictly Proper Scoring Rules, Prediction, and Estimation*, Journal of the American Statistical Association: https://doi.org/10.1198/016214506000001437

### 3. Prediction intervals under temporal dependence

Conformal methods can calibrate intervals using past forecast errors and finite-sample order statistics. The standard exchangeability guarantee does not automatically carry over unchanged to dependent, non-stationary market time series. Therefore the implementation filters by what was observable at the forecast issue time, uses a chronological calibration window, exposes insufficient-data states, and must be monitored for realized coverage by horizon and market regime.

References:
- Xu and Xie (2023), *Sequential Predictive Conformal Inference for Time Series*, ICML / PMLR: https://proceedings.mlr.press/v202/xu23r.html
- Barber and Pananjady (2026), *Predictive inference for time series: why is split conformal effective despite temporal dependence?*, ALT / PMLR: https://proceedings.mlr.press/v313/barber26a.html

### 4. Regime changes and model trust

Housing markets react to rates, lending conditions, supply constraints, incomes, migration, regulation, and local market liquidity. Relationships can change across geographies and cycles. A regime warning should lower trust and broaden uncertainty—not automatically assert a crash or force a particular direction.

### 5. Evidence hierarchy

Prefer timestamped first-party statistical sources and transparent revision histories (e.g. national statistical offices, central banks, Eurostat, OECD, BIS, ECB). Third-party asking-price data can be useful as a high-frequency signal but must not be conflated with completed transaction prices. Store source, series identifier, units, geography, observation time, release time, retrieval time, revision/version, and license.

## Research guardrails

- No publication or model name proves out-of-sample skill for Czech property prices; validate locally by region and horizon.
- Keep baselines (no-change, seasonal/naive, and simple economic predictors) in every evaluation.
- Use a locked chronological test period after model selection.
- Track MAE/MASE for point forecasts; Brier/log loss for event probabilities; quantile/interval scores and empirical coverage for uncertainty.
- Record model, features, hyperparameters, data cutoff, and forecast-time evidence for each issued prediction.
- Treat astrophysics, sunspot cycles, or other distant signals as hypotheses only. Do not use them unless a defensible causal mechanism is specified in advance and prospective out-of-sample testing shows incremental skill after multiple-testing corrections.
- Distinguish association from causation. A causal graph is a set of explicit assumptions, not causal proof by itself.
