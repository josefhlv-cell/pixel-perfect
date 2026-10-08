# Future OS — Preregistration v0.1

## Scope

This experiment evaluates two preregistered hypotheses on vintage, point-in-time housing data.

- **H1 (primary Survival hypothesis):** ranking scenarios with probability, stress/survival score and information improves out-of-sample predictive performance versus probability-only ranking.
- **H2 (primary Trajectory hypothesis):** scenarios whose preregistered bottleneck edge is subsequently confirmed have higher out-of-sample realized accuracy than scenarios whose bottleneck is not confirmed, and the advantage exceeds a random-link comparator.

The primary H1 decision concerns Survival. The primary H2 decision concerns Trajectory. The secondary eight-node trajectory is exploratory and is evaluated only after the primary results are closed.

## Prediction/reveal separation

For every walk-forward origin, the runner must:

1. construct the vintage dataset available at `as_of(t)`;
2. fit and score the prediction;
3. create the complete prediction record and provenance;
4. append the prediction record to the append-only prediction journal;
5. only after successful append may the runner enter REVEAL and load realization data;
6. score the already-committed prediction against the realization.

A realization without a previously committed prediction is invalid by construction.

## Edge robustness

All edge robustness components are normalized to [0,1] using training-only quantile normalization.

`robustness = survival * (0.5 * evidence + 0.5 * association)`

`SUPPORTED` and `HYPOTHESIS` are reporting metadata only and do not alter the score.

The primary trajectory uses geometric-mean path survival.

## Bottleneck

Bottleneck = minimum edge robustness.

Tie-break: lexicographic edge ID.

A bottleneck is **not identified** when the absolute difference between the two lowest edge robustness scores is < 0.05 on the preregistered [0,1] scale.

Such observations are reported as `NO_BOTTLENECK` and are excluded from the identified-bottleneck H2 comparison.

If `NO_BOTTLENECK` exceeds 50% of eligible primary-H2 cases, H2 is reported as **UNRESOLVED**, not rejected.

## Primary H2 graph

The primary H2 graph contains four states and three edges:

`MONETARY_CONDITIONS -> MORTGAGE_CREDIT -> BUYER_DEMAND -> TRANSACTIONS`

The final edge is explicitly marked as a hypothesis rather than assumed literature support.

The secondary trajectory containing purchasing power, liquidity, price pressure and house prices is exploratory.

## H2 confirmation

H2 target is the scenario's preregistered realization accuracy over the 12-month forecast horizon.

A bottleneck edge is confirmed using only information whose vintage date is available before the end of the prediction horizon. No post-horizon revised data may determine confirmation.

Confirmation rules and thresholds are derived from the training portion only and are not tuned on the held-out realization.

## Statistical power

Before the first production run, the runner must report:

- number of non-overlapping origins;
- number of regions;
- number of eligible and identified bottlenecks;
- effective number after dependence adjustment;
- minimum detectable effect under the preregistered block-bootstrap design.

Low power is reported as inconclusive evidence, not evidence of no effect.

## Fixed ablations

All ablations use identical regions, origins, horizons, vintage snapshots, seeds and evaluation windows.

1. BASELINE — probability only
2. +INFORMATION — probability + information
3. +SURVIVAL — probability + survival
4. +SURVIVAL+INFORMATION — full H1
5. +TRAJECTORY — full H1 + trajectory
6. EXPLORATORY_SECONDARY_TRAJECTORY — secondary graph, reported only after primary closure

Every configuration has its own canonical config hash.

## Reproducibility

The prediction provenance must include:

- experiment/config hash;
- Git commit SHA;
- dependency lockfile hash;
- random seed;
- vintage snapshot hash;
- data source identifiers;
- code version;
- prediction origin and horizon.

The vintage snapshot used for an experiment must be retained immutably or the experiment is not reproducible.

## Failure rules

The following outcomes do not trigger parameter retuning:

- NO_BOTTLENECK > 50%;
- confidence interval contains zero;
- minimum detectable effect is not achieved;
- H1/H2 fails the preregistered acceptance rule;
- insufficient eligible regions/windows.

In these cases the result is **UNRESOLVED** or **REJECTED** according to the relevant hypothesis.

Adding regions/windows, changing thresholds, changing the graph, changing the aggregation, changing attacks, or changing score exponents requires a new preregistered experiment version.

## Acceptance

No component is considered validated by implementation or unit tests alone.

H1 and H2 are accepted only from the preregistered walk-forward evaluation, with the predefined metrics and block-bootstrap uncertainty intervals.

No result may be retroactively promoted from exploratory to primary.
