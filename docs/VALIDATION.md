# ED Throughput Sandbox: verification and validation plan

## Status and evidence rule

This document is the standalone verification and validation plan for model/schema version 1. It defines what must be tested and the oracles that determine success. It does **not** claim that a test has passed merely because the test is listed here. Commands, environments, results, failures, waivers, and review evidence belong in `docs/QA.md` and continuous-integration artifacts.

The application is a synthetic educational model. Code verification can show that the engine implements [MODEL.md](./MODEL.md); it cannot establish that the model represents a real emergency department. No empirical or predictive validation is claimed.

## 1. Validation vocabulary and scope

- **Conceptual-model review:** confirm that the documented entities, states, events, queues, resources, assumptions, metrics, and claim boundary are internally coherent and understandable to intended users.
- **Implementation verification:** confirm that code implements the documented algorithms and event logic.
- **Numerical verification:** compare random-number, distribution, quantile, integration, and aggregation routines with independent or exact oracles.
- **Model-behavior validation:** use controlled fixtures and synthetic experiments to check that behavior is plausible under the model's own assumptions.
- **Empirical validation:** compare model inputs and outputs with institution-specific observations. This is outside the present product because it has no hospital dataset or calibrated parameters.

UI behavior, accessibility, responsive layout, dependency security, privacy, and deployment checks are release requirements but are audited separately in `docs/QA.md`. This plan focuses on simulation correctness and the scenario data entering it.

## 2. Release gates

Every applicable gate below is required before release. `Pending` is the initial status; only recorded evidence may change it. V7's release gate is the committed deterministic and fixed-seed distribution suite; the large-sample goodness-of-fit work in Section 9 is an additional diagnostic. V8 applies before claiming formal equivalence on a browser engine beyond the current Node/Chromium release matrix.

| Gate                             | Required evidence                                                                    | Initial status |
| -------------------------------- | ------------------------------------------------------------------------------------ | -------------- |
| V1 — deterministic conformance   | Exact PRNG/seed vectors and fixed duration-transform vectors pass                    | Pending        |
| V2 — event engine                | All deterministic fixtures in Section 4 pass                                         | Pending        |
| V3 — invariants                  | Assertions plus generated-case tests pass without counterexample                     | Pending        |
| V4 — window and metrics          | Boundary, cohort, integral, quantile, and aggregation oracles pass                   | Pending        |
| V5 — CRN and reproducibility     | Repeat-run equality, identical-scenario zero deltas, and stream-alignment tests pass | Pending        |
| V6 — scenario validation         | Valid round trips succeed; malformed or out-of-range state is rejected safely        | Pending        |
| V7 — stochastic numerical sanity | Fixed-seed support, boundary, moment, and inverse-CDF checks pass                    | Pending        |
| V8 — cross-runtime portability   | Required before adding a formal cross-engine numerical-conformance claim             | Conditional    |
| V9 — claim boundary              | Methodology and UI say synthetic, illustrative, uncalibrated, and not for decisions  | Pending        |

A skipped required test, an unexplained snapshot update, or an unreviewed changed test vector fails its gate. A model change that intentionally alters a vector requires a new model/algorithm version and an explicit migration note; updating expected output alone is not sufficient justification.

## 3. Deterministic numerical conformance

### 3.1 PRNG and seed mixer

The normative identifier is `edts-prng-v1-mulberry32-mix32`. Tests must exercise unsigned wraparound, `Math.imul` behavior, zero-state fallback, stream-tag order, and at least these exact vectors:

| Operation                             | Expected seed | First four unsigned 32-bit output words          |
| ------------------------------------- | ------------: | ------------------------------------------------ |
| Initialize generator with `1`         |           `1` | `2693262067, 11749833, 2265367787, 4213581821`   |
| Derive `(20260831, 0x415252, 0, 0)`   |  `2036032225` | `2312405730, 538637787, 3147352936, 3080807377`  |
| Derive `(20260831, 0x504154, 0, 0)`   |   `278027772` | `1331915774, 1762190320, 2457447237, 1473026535` |
| Derive `(20260831, 0x504154, 7, 123)` |   `642873659` | `985288489, 1450344597, 2782806137, 1331530683`  |

The integer words are the primary oracle and must match exactly. Dividing the first patient vector by `2^32` must give the four ordered uniforms:

```text
acuity   = 0.31011080695316195
service  = 0.41029190644621849
admit    = 0.57216902193613350
boarding = 0.34296571626327932
```

For the flat profile, hourly mean 6, master seed `20260831`, replication 0, and absolute hour 0, the exact product-method Poisson result is 8. After consuming the count draws, the sorted minute offsets must be:

```text
8.710606112144887
13.623445630073547
16.320034693926573
18.486077995039523
19.595053461380303
27.287182160653174
44.50973199214786
49.99086117837578
```

This single-hour vector verifies that the count and offsets share the hour-local stream and that offsets are sorted. Separate tests verify that changing hour `k` cannot change the stream for any other hour.

### 3.2 Conditional lognormal transform

The normative identifier is `edts-distributions-v1`. Compare these calls with absolute or relative tolerance `1e-12`:

| `(parent median, sigma, lower, upper, uniform)` |     Expected minutes |
| ----------------------------------------------- | -------------------: |
| `(180, 0.60, 5, 1440, 0.50)`                    | `179.96420993521434` |
| `(240, 0.75, 1, 4320, 0.50)`                    | `239.98687878555936` |
| `(90, 0.35, 5, 1440, 0.10)`                     |  `57.47020403964109` |
| `(240, 0.85, 5, 1440, 0.90)`                    | `663.54700984761575` |

For a dense deterministic grid of `u` values, including `0`, `Number.EPSILON`, `(2^32 - 1)/2^32`, and `1`, tests must also establish:

- finite output;
- `lower <= output <= upper` despite numerical approximation error;
- output nondecreasing in `u`;
- no rejection loop or variable random-draw count;
- treatment spread selected from exactly `0.35`, `0.60`, and `0.85`;
- boarding spread fixed at `0.75`; and
- parent median 0 returns boarding duration 0 without evaluating logarithms or an inverse CDF.

An independent oracle should evaluate `a + u(b-a)` with a high-accuracy normal CDF/inverse CDF to confirm the intended conditional distribution. That comparison validates the mathematical construction; the fixed vectors separately freeze the implementation's declared Abramowitz--Stegun/Acklam approximations.

### 3.3 Profiles, categories, and quantiles

- Every stored 24-hour multiplier vector must be finite, nonnegative, and normalize to arithmetic mean 1 within `1e-12`.
- A custom profile with positive finite entries must preserve expected daily arrivals after normalization; an all-zero, negative, or nonfinite profile must fail validation.
- Acuity boundary tests use values immediately below, exactly at, and immediately above each cumulative threshold. With `(0.12, 0.56, 0.32)`, `u < 0.12` is high, `0.12 <= u < 0.68` is moderate, and `u >= 0.68` is low.
- Type-7 quantiles are checked against hand calculations for empty, singleton, odd, even, repeated, and unsorted arrays. Empty input returns undefined/`N/A`, not zero.

## 4. Deterministic event-engine fixtures

Fixtures bypass stochastic duration sampling and declare exact arrivals, acuity, treatment duration, admission outcome, and boarding duration. Unless a fixture says otherwise, use one main space, no fast track, warm-up 0, and a 60-minute analysis window.

| ID                            | Fixture and exact oracle                                                                                                                                                                                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F01 — empty                   | No patients. Arrivals, departures, end queue, end occupancy, peaks, average occupancy, and boarder-hours are 0. Wait/LOS cohorts are `N/A`; all time-series bins are numeric zero.                                                                                                               |
| F02 — one discharge           | Low-acuity patient arrives at 0, treatment is 10, discharged. Start 0, completion/departure 10, wait 0, LOS 10, peak occupancy 1, occupied area 10 space-minutes, average occupancy `1/6`, and end state 0.                                                                                      |
| F03 — release/arrival batch   | One patient occupies the only main space until 10. A low- and a high-acuity patient arrive at 10. Completion/release occurs first, both arrivals are queued, then high starts at 10 and low remains waiting. No dispatch occurs between events in the batch.                                     |
| F04 — stable FIFO             | Three same-tier patients arrive at the same time. They start in patient-ID/queue insertion order. Repeating with a deliberately perturbed heap layout must not change the order.                                                                                                                 |
| F05 — strict priority         | A low patient waits while the space is busy; a later high patient arrives before release. At release, high starts first. The in-service patient is never preempted.                                                                                                                              |
| F06 — fast track              | With total capacity 2 and fast-track allocation 1, simultaneous high and low patients occupy main and fast-track respectively. High and moderate never use fast track. A second low waits once both eligible pools are full. Max main occupancy is 1, fast-track occupancy is 1, and total is 2. |
| F07 — zero boarding           | An admitted patient completes 10 minutes of treatment with boarding duration 0. The space is released and departure recorded at 10, LOS is 10, and boarder-hours are 0. A same-time eligible waiter can start only after the completion batch reaches dispatch.                                  |
| F08 — boarding blocks         | An admitted patient completes treatment at 10 and boards for 20. The space remains occupied through `[10,30)`, boarder area is 20 patient-minutes, departure is 30, and an eligible waiter cannot start before 30.                                                                               |
| F09 — boarder crosses warm-up | Warm-up is 60 and analysis is `[60,120)`. A patient arrives 0, completes treatment 10, and boards until 80. Analysis occupancy and boarder areas are each 20; boarder-hours are `1/3`; departure at 80 is counted; the pre-warm-up arrival and start are not.                                    |
| F10 — analysis start          | With warm-up 60, events at exactly 60 belong to analysis. Pre-event carried state contributes from 60 onward; an arrival/start/departure at 60 enters the appropriate event cohort.                                                                                                              |
| F11 — analysis end            | In analysis `[0,60)`, a patient arrives 50 and is due to depart exactly 60. The departure is excluded and not applied to the reported end state: occupancy at `60-` is 1, remaining in system is 1, and occupied area is 10.                                                                     |
| F12 — analysis-only peaks     | Create higher occupancy and queue peaks during warm-up than during analysis, then clear them before the boundary. Reported peaks equal the analysis-window maxima, including state at the analysis start, and exclude warm-up and exact-end states.                                              |
| F13 — exact integration       | Use change points that split a 15-minute bin at noninteger minutes. Hand-sum `state * interval length` for occupancy, queue, and boarders. Each bin and the full-window averages must equal those areas divided by bin/window length; no endpoint snapshot substitution is allowed.              |
| F14 — conservation            | At every stable post-dispatch state, cumulative arrivals equal departures plus waiting plus occupying. Treatment-to-boarding changes classification but not the total in system.                                                                                                                 |
| F15 — no post-period drain    | A queued patient and a treating or boarding patient at the end remain in the end-state metrics. No future completion is simulated merely to complete a metric cohort.                                                                                                                            |

F03 and F07 are also regression tests for the normative same-time order: boarding completions, treatment completions, arrivals, then one exhaustive dispatch. Same-kind event ties use event insertion sequence; FIFO ties within an acuity queue use `(queueEntryTime, patientId)`.

## 5. Runtime invariants and generated cases

The test build should expose a post-dispatch invariant hook. Run it after every event batch for hand fixtures and for generated valid scenarios. At minimum it asserts:

### Capacity and eligibility

- `0 <= mainOccupied <= totalSpaces - fastTrackSpaces`.
- `0 <= fastTrackOccupied <= fastTrackSpaces`.
- `0 <= mainOccupied + fastTrackOccupied <= totalSpaces`.
- `0 <= boarders <= occupied`.
- One patient occupies at most one space; one space serves at most one patient.
- High and moderate acuity never occupy fast track.
- A boarding patient retains the same pool allocation until departure.
- After dispatch, no eligible patient waits while a compatible space is idle.

### Chronology and flow

- Removed event timestamps are nondecreasing.
- `arrival <= treatmentStart <= treatmentCompletion <= departure` whenever those fields exist.
- A patient starts treatment at most once and departs at most once.
- A released occupancy is never negative and a single occupation is released exactly once.
- Discharged `LOS = wait + treatment` within floating tolerance.
- Admitted `LOS = wait + treatment + boarding` within floating tolerance.
- Stable-state flow conservation from F14 always holds.

### Numeric safety

- Durations and event times are finite and nonnegative.
- Queue lengths, counts, occupancy, boarder counts, and boarder-hours are nonnegative.
- No result crossing the simulation/UI boundary is `NaN` or infinite.
- Undefined cohorts remain `null` internally and render/export as `N/A`.

Generated-case tests should cover valid parameter extremes, all three variability presets, boarding zero/nonzero, fast track on/off, every acuity tier, very low/high demand, and event-time ties. Record the random seed for every generated case so a counterexample is replayable. Shrinking must retain valid capacity and probability constraints.

## 6. Window, cohort, and metric verification

Every time predicate is tested at `boundary - epsilon`, `boundary`, and `boundary + epsilon` for both warm-up start and analysis end.

### 6.1 Cohorts

- Arrival/departure counts include events in `[warmUp, analysisEnd)` only.
- Wait metrics use treatment starts in that interval, including patients who arrived during warm-up.
- LOS metrics use departures in that interval, including patients who arrived or started during warm-up.
- A patient arriving during analysis but unfinished at the end is excluded from LOS and included in the appropriate end-state count.
- Empty overall or acuity-specific cohorts return `N/A` independently; they do not invalidate unrelated metrics.

### 6.2 State metrics

- End state is the left-hand state at `analysisEnd-`.
- Peaks use stable post-dispatch states within analysis and include carried state at the start.
- `averageOccupied = occupied space-minutes / analysisMinutes`.
- `boarderHours = boarder patient-minutes / 60`.
- High-occupancy time uses `occupied >= ceil(0.90 * totalSpaces)` and an exact time integral.
- Ninety-six 15-minute status bins cover a 24-hour analysis period without gaps or overlap. Partial-bin behavior is separately tested when a custom short fixture horizon is used.
- Sum of bin areas equals the corresponding whole-window area within floating tolerance.

### 6.3 Across-replication aggregation

For hand arrays, independently calculate median, P10, and P90 using type-7 interpolation. Verify that:

- aggregation occurs after each replication's metric is computed;
- undefined values are excluded, not replaced by zero;
- the valid-replication count is retained and exposed;
- paired delta is formed as `B_r - A_r` before quantiles;
- a marginal interval is never subtracted from another marginal interval; and
- paired percentage change is `N/A` when the replication's A denominator is zero.

## 7. Reproducibility and common random numbers

1. Run the same complete scenario, seed, replication index, model version, and algorithm version twice; raw patient streams and unrounded results must match.
2. Run a nondegenerate scenario under two distinct seeds; at least one raw arrival or patient stream word must differ. This is a generator check, not a statistical independence proof.
3. Verify that an absolute-hour arrival stream depends only on `(masterSeed, replication, absoluteHour)` and the fixed arrival tag.
4. Verify that a patient's four uniforms depend only on `(masterSeed, replication, patientOrdinal)` and the fixed patient tag, not on capacity, routing, queue events, or completion order.
5. With identical A/B demand, corresponding arrivals and patient uniforms must match exactly even when operational resources differ.
6. An identical A/B scenario must produce exact zero paired deltas for every defined metric.
7. When demand inputs differ, verify that the UI/export does not claim patient-level alignment even though replication indices remain paired.
8. Exports must identify or unambiguously imply the model/schema, PRNG, and duration-transform versions needed to reproduce the run.

Portability is tested on every supported browser. Raw integer outputs must be exact. Duration and aggregate floating values use declared tolerances, with full-result differences logged; a fixed 32-bit PRNG alone is not evidence that browser transcendental functions are bit-identical.

## 8. Scenario validation, import, and export

Tests must cover direct validation, JSON parsing, URL-decoded state, and import/export round trips:

- A valid scenario round trip preserves every simulation input, schema version, active scenario, and seed.
- Importing normalized acuity values preserves their ratios and records that normalization when applicable.
- Reject missing fields, unknown schema versions, unsafe or overlong names, nonobjects, unexpected array shapes, nonfinite numbers, negatives, all-zero mixes/profiles, probabilities outside caps, fractional capacity/allocation/replication/seed values, invalid fast-track allocation, invalid medians/scales, replication counts outside guardrails, and seed 0 or values above `2^32 - 1`.
- Direct numeric entry must snap to the declared control step. Validation must run on an immutable snapshot before cache lookup/worker dispatch and again inside the worker; invalid input must not produce or cache results.
- Validate the **effective** main-treatment parent median after applying treatment-time scale, not only the two inputs independently.
- Fast-track parent median must be 5–720 minutes; boarding parent median must be 0–1,440 minutes.
- A disabled fast track still stores valid dormant settings but contributes zero capacity.
- Oversized import text and malformed JSON fail with a safe, user-readable error.
- Failed import is atomic: it does not partially overwrite the active valid scenario.
- A sensitivity result is current only when its full source-scenario key, selected parameter, and outcome all match; a comparison is stale when either displayed scenario differs from its completed result.
- Exports contain only synthetic scenario/configuration/results data and no patient identifiers or hidden application state.

For the overall-admission control, use the canonical anchor `(0.45, 0.18, 0.03)`, caps `(0.90, 0.60, 0.20)`, and the current acuity mix. Test target 0, each cap breakpoint, maximum feasible target, and infeasible targets. The displayed weighted rate must agree with `sum(w_i p_i)` within `1e-10`; infeasible input must be rejected or visibly constrained, never silently presented as achieved.

## 9. Stochastic numerical checks

Exact deterministic tests carry the release decision; statistical checks are additional diagnostics. Their sample sizes, seed banks, and tolerances must be committed before results are examined so a failure is not hidden by rerunning a favorable seed.

### Poisson counts

For several hourly means spanning the supported range, generate at least 100,000 independently keyed hour streams. With sample size `n` and target mean `q`, require the sample mean to lie within `6 * sqrt(q/n)` of `q`. Require the unbiased sample variance to lie within `6 * sqrt((q + 2q^2)/(n - 1))` of `q`, and inspect count histograms against exact Poisson probabilities. Include `q = 0` as an exact zero test.

### Within-hour offsets and categories

Pool offsets only after conditioning on count. Check support `[0,60)`, sorted order within each hour, and uniformity with a preregistered goodness-of-fit test. For acuity and admission draws, check observed proportions against configured probabilities using fixed seeds and six-binomial-standard-error bounds, including exact boundary behavior from Section 3.3.

### Conditional durations

For a dense uniform grid, transform `u` and compare empirical quantiles with an independently evaluated conditional-lognormal quantile function. Repeat for every treatment sigma, boarding sigma, values near both bounds, and boarding median 0. Confirm the sampler produces no clipping point masses and consumes one mapped uniform per nonzero transform.

A statistical failure requires investigation; it must not be dismissed solely because another seed passes. Conversely, passing these checks does not validate the synthetic parameter values.

## 10. Model-behavior sanity experiments

Use matched fixed patient streams and change one mechanism at a time:

- Reducing one admitted patient's boarding duration cannot prolong that same patient's space occupation.
- Adding an otherwise identical **main** treatment space increases configured main capacity by one and never creates an over-capacity state.
- Eliminating arrivals eliminates future queue growth after the existing workload clears.
- A released space is reassigned at the same timestamp when an eligible patient waits.
- Fast-track resources are never used by high or moderate acuity.
- Strict acuity priority and within-tier FIFO behave as documented.
- Setting every admission probability to zero produces no boarders.
- With a fixed admitted fixture, increasing boarding duration increases that patient's boarding interval and occupied-space time by the same amount until the analysis boundary truncates the contribution.

These are controlled mechanism tests. Do **not** require every finite-sample aggregate metric to be monotone under stochastic scenario changes: queueing interactions, right censoring, routing, and Monte Carlo variation can produce nonmonotone summaries.

## 11. Required test-to-claim traceability

The implementation test suite must make these original acceptance claims directly discoverable:

| Required claim                                            | Primary coverage                |
| --------------------------------------------------------- | ------------------------------- |
| Zero arrivals produce zero queue/occupancy/departures     | F01                             |
| Known one-patient event times                             | F02                             |
| Total, main, and fast-track capacity never exceeded       | F06 and invariant suite         |
| Event timestamps nondecreasing                            | chronology invariants           |
| Same seed reproducible; different seeds alter streams     | Section 7                       |
| No start/departure before arrival                         | chronology invariants           |
| Discharged/admitted LOS decomposition                     | F02, F08, chronology invariants |
| Boarding retains a treatment space                        | F08–F09                         |
| Identical scenarios have zero deltas                      | Section 7                       |
| Import/export preserves valid scenario                    | Section 8                       |
| Invalid probabilities, capacities, and durations are safe | Section 8                       |
| Acuity percentages are normalized correctly               | Sections 3.3 and 8              |
| No negative, `NaN`, or infinite displayed result          | numeric invariants              |
| Empty eligible cohorts handled                            | F01 and Section 6               |
| Warm-up excluded while state carries forward              | F09–F12                         |
| Same-time release, arrival, and dispatch order            | F03 and F07                     |
| Exact time-weighted metrics                               | F13 and Section 6               |

## 12. Empirical-validation boundary and future protocol

There is currently no institution-specific input dataset, stakeholder-approved conceptual model, fitted input model, or historical holdout set. Therefore the app is **not empirically validated**, is not a forecasting tool, and cannot support staffing or clinical decisions.

If a future institution-specific adaptation is proposed, it requires a separate governed protocol at minimum:

1. define the use case, decision boundary, population, time period, and success criteria with operational and clinical stakeholders;
2. obtain approved, deidentified data and document missingness, exclusions, timestamp semantics, and data lineage;
3. estimate and test time-varying arrivals, acuity mix, treatment, admission, boarding, and relevant dependencies rather than reusing illustrative defaults;
4. review the conceptual model and simplifications with domain experts;
5. calibrate only on a training period and reserve independent days for validation;
6. compare distributions and time series, not only overall means, using predeclared error measures;
7. assess initialization, run length, rare overload, parameter uncertainty, and sensitivity;
8. investigate discrepancies and document where the model is not fit for purpose; and
9. monitor data and process drift after any approved deployment.

Passing software tests remains necessary but is never a substitute for this empirical work.

## 13. Evidence record

For each release candidate, `docs/QA.md` or linked CI artifacts must record:

```text
commit/release identifier:
model/schema version:
PRNG version:
duration-transform version:
date and reviewer:
operating system and architecture:
Node/package-manager versions:
supported browser versions:
commands executed:
test counts (pass/fail/skip):
property-test seeds and counterexamples:
cross-browser numeric comparison:
open defects and disposition:
artifact or CI URLs:
```

The normal automated evidence set includes `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, the applicable Playwright suite, and the repository's complete `npm run check`. Report actual output; do not describe an unrun command as passing.
