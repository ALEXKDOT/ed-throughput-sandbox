# ED Throughput Sandbox: simulation model specification

## Status and intended use

ED Throughput Sandbox is a **synthetic, educational, client-side discrete-event simulation (DES)**. It is designed to make interactions among demand, treatment-space capacity, composite treatment time, admission pressure, and boarding visible. It is not calibrated to any institution, is not a forecasting model, and must not be used for staffing, clinical, regulatory, or operational decisions.

Every numerical default, preset, guardrail, arrival-profile shape, distribution spread, and truncation bound in this document is a project-specific illustrative assumption unless explicitly identified otherwise. The cited literature supports the conceptual framework, definitions, or modeling methods; it does **not** validate the app's defaults as hospital benchmarks. See [SOURCES.md](./SOURCES.md).

## 1. Conceptual model and scope

The model follows the input-throughput-output framework described by Asplin and colleagues [S1](./SOURCES.md#s1-asplin-et-al-2003):

- **Input:** stochastic arrivals, time-of-day arrival pattern, and a three-tier operational acuity mix.
- **Throughput:** a finite pool of treatment spaces, nonpreemptive priority queues, composite treatment durations, and optional reallocation of some spaces to a low-acuity fast track.
- **Output:** acuity-dependent admission, a stochastic aggregate boarding interval, and continued occupation of the ED treatment space while boarding.

DES is appropriate here because patients arrive at irregular times, compete for finite resources, change state at discrete events, and may block a resource after treatment. Published ED models provide precedent for patient-level DES, time-varying Poisson arrivals, categorical acuity, lognormal treatment durations, acuity-dependent admission, fast-track comparisons, and explicit boarding [S2](./SOURCES.md#s2-hoot-et-al-2008), [S3](./SOURCES.md#s3-bair-et-al-2010), and [S4](./SOURCES.md#s4-connelly-and-bair-2004). This app is deliberately much smaller than a hospital-calibrated model.

The simulation clock is continuous and measured in minutes. It advances directly to the next scheduled event; it does not step through every minute.

### 1.1 What one simulated patient represents

Each patient is a synthetic operational entity with only these fields:

- deterministic synthetic identifier;
- arrival time and queue-entry time;
- high, moderate, or low operational acuity;
- treatment-start time;
- main or fast-track treatment-space type;
- treatment-completion time;
- synthetic admission outcome;
- boarding-completion time when admitted; and
- departure time.

There are no names, diagnoses, demographics, notes, clinical decisions, clinician identities, or real patient records.

### 1.2 State transitions

```text
arrival
  |
  v
waiting by acuity --eligible space--> in treatment
                                         |
                         +---------------+---------------+
                         |                               |
                      discharge                        admit
                         |                               |
                         v                               v
                     departed                    boarding in the
                                                 same ED space
                                                        |
                                                        v
                                                    departed
```

Treatment is a composite operational duration. It combines, without separately representing, examination, clinician availability, diagnostics, treatment, reassessment, and disposition work.

## 2. Time horizon and initialization

Each replication runs for 2,880 minutes:

- **Warm-up:** `[0, 1,440)` minutes (24 hours).
- **Analysis:** `[1,440, 2,880)` minutes (the following 24 hours).

The system begins empty at minute 0. Arrivals occur throughout both periods, using the same daily intensity profile repeated on day two but independent random draws for each absolute hour. Patients and backlog present at minute 1,440 carry into the analysis period. Nothing observed before minute 1,440 is included in reported event counts, patient-event cohorts, or time integrals.

The warm-up reduces the artificial advantage of starting with an empty ED [S5](./SOURCES.md#s5-law-2015), [S7](./SOURCES.md#s7-grassmann-2014). Twenty-four hours is a transparent project choice aligned to one daily arrival cycle; it is not proof that initialization bias has vanished. In severely overloaded scenarios a stationary regime may not exist, and a one-day warm-up may be inadequate. The app must state that limitation.

The analysis interval is half-open. An event at exactly minute 1,440 belongs to the analysis period; an event at exactly minute 2,880 does not. End-of-period state means the left-hand state at `2,880−`.

There is no post-period drain. Unfinished patients remain waiting or occupying a space at the analysis boundary and are counted in end-state metrics.

## 3. Scenario inputs and illustrative defaults

| Domain     | Input                          |               Illustrative default | Guardrail / rule                                                          |
| ---------- | ------------------------------ | ---------------------------------: | ------------------------------------------------------------------------- |
| Input      | Mean arrival rate              |                  6.0 patients/hour | UI range 1–25                                                             |
| Input      | Arrival profile                |                       Daytime peak | Hourly multipliers normalized to mean 1                                   |
| Input      | Acuity mix                     |    High 12%, moderate 56%, low 32% | Nonnegative; exactly normalized to 1                                      |
| Throughput | Total treatment spaces         |                                 24 | Integer, UI range 5–80                                                    |
| Throughput | Main-treatment parent medians  | High 240, moderate 180, low 90 min | Positive; effective parent median 5–1,440 min                             |
| Throughput | Treatment-time scale           |                               1.00 | Multiplies the three main-treatment medians                               |
| Throughput | Treatment-duration variability |          Moderate (`sigma = 0.60`) | Low 0.35; high 0.85                                                       |
| Throughput | Fast track                     |                           Disabled | If enabled, reallocates spaces from total                                 |
| Throughput | Fast-track allocation          |                           4 spaces | Integer `1..C-1`                                                          |
| Throughput | Fast-track parent median       |                             60 min | Positive; 5–720 min                                                       |
| Output     | Tier admission probabilities   |     High 45%, moderate 18%, low 3% | Bernoulli probabilities; see Section 8                                    |
| Output     | Weighted overall admission     |              16.44% at default mix | Derived as `sum(w_i p_i)`                                                 |
| Output     | Boarding parent median         |                            240 min | UI range 0–1,440; zero is deterministic                                   |
| Experiment | Replications                   |                                100 | Integer, UI range 20–200                                                  |
| Experiment | Master seed                    |                         20,260,831 | Positive unsigned 32-bit integer; visible, saved, exported, and shareable |
| Reporting  | Time-series bin width          |                             15 min | 96 bins over analysis day                                                 |

All presets must carry the label **Illustrative synthetic scenario**. Imports outside schema guardrails are rejected with field-level errors; values are never silently allowed to become negative, nonfinite, or probabilistically invalid.

## 4. Arrivals

### 4.1 Piecewise-constant nonhomogeneous Poisson process

Let `lambda` be the scenario's mean arrivals per hour and let `m[h]` be the multiplier for hour of day `h = 0,...,23`. The engine first normalizes a profile:

```text
m_norm[h] = m_raw[h] / ((1/24) * sum_{j=0}^{23} m_raw[j])
```

All raw multipliers must be finite and nonnegative, with a strictly positive sum. After normalization, their arithmetic mean is 1, so expected arrivals per 24 hours remain `24 * lambda` for every profile.

For each absolute simulation hour `k = 0,...,47`, with hour of day `h = k mod 24`:

1. draw `N_k ~ Poisson(lambda * m_norm[h])`;
2. draw `N_k` independent offsets `U_j ~ Uniform(0, 60)` minutes;
3. sort the offsets ascending; and
4. create arrivals at `60k + U_(j)`.

This is the exact conditional construction of a homogeneous Poisson process within each constant-intensity hour. Arrivals are not evenly spaced. Tied floating-point times are ordered by generation ordinal.

Time-varying Poisson arrivals are a published ED DES precedent [S2](./SOURCES.md#s2-hoot-et-al-2008), but the following shapes are original illustrative profiles, not estimates from a hospital.

### 4.2 Stored hourly multiplier profiles

Values are listed from midnight–00:59 through 23:00–23:59. The vectors below are already normalized to a mean of 1 (minor decimal roundoff is renormalized at runtime).

```text
Flat
[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]

Daytime peak
[0.575916, 0.502618, 0.460733, 0.439791, 0.481675, 0.607330,
 0.816754, 1.068063, 1.298429, 1.445026, 1.518325, 1.549738,
 1.507853, 1.445026, 1.382199, 1.340314, 1.277487, 1.204188,
 1.089005, 0.984293, 0.879581, 0.785340, 0.712042, 0.628272]

Evening peak
[0.541127, 0.460960, 0.420877, 0.400835, 0.430898, 0.521086,
 0.651357, 0.781628, 0.901879, 0.982046, 1.052192, 1.102296,
 1.162422, 1.222547, 1.302714, 1.422965, 1.563257, 1.683507,
 1.703549, 1.583299, 1.382881, 1.142380, 0.901879, 0.681420]

Overnight-heavy
[1.522718, 1.591486, 1.532542, 1.395006, 1.257470, 1.100287,
 0.903807, 0.766271, 0.668031, 0.609087, 0.569791, 0.550143,
 0.569791, 0.609087, 0.668031, 0.726975, 0.785919, 0.864511,
 0.962751, 1.060991, 1.159230, 1.277118, 1.375358, 1.473598]
```

A custom profile is edited as six four-hour blocks. Each block value is expanded to its four constituent hours, then the resulting 24-vector is normalized. The full normalized hourly vector must appear in scenario JSON and methodology/export views.

## 5. Acuity and queue discipline

Each arrival receives one operational acuity tier by a categorical draw with probabilities `w_H`, `w_M`, and `w_L`. The default vector is `(0.12, 0.56, 0.32)`.

For direct UI entry, the three percentages must sum to 100% within display precision. For imported data, all entries must be finite and nonnegative and their sum must be positive. The validator may normalize a valid positive vector by its sum, but must report that normalization to the user; it must reject an all-zero, negative, or nonfinite vector.

There are three FIFO queues, one per tier. Main-space selection is strict and nonpreemptive:

```text
high > moderate > low
```

FIFO applies within a tier using `(queueEntryTime, patientId)` as the deterministic key. A later high-acuity arrival may start before an earlier low-acuity arrival, but a patient already in treatment is never interrupted. The model does not include deterioration, reassessment, resuscitation resources, or preemption.

Strict priority can produce very long low-acuity waits under overload. That is a known model behavior and limitation, not a clinical recommendation.

## 6. Treatment-space resources

Let:

- `C` = total configured treatment spaces;
- `F` = fast-track allocation, or zero when disabled; and
- `M = C - F` = main-space capacity.

Fast-track allocation is a reallocation, not an addition. When enabled, `1 <= F < C`; otherwise `F = 0`. Main occupancy can never exceed `M`, fast-track occupancy can never exceed `F`, and combined occupancy can never exceed `C`.

Eligibility is:

| Acuity   | Main space | Fast-track space |
| -------- | ---------: | ---------------: |
| High     |        Yes |               No |
| Moderate |        Yes |               No |
| Low      |        Yes |              Yes |

When a patient starts treatment, one eligible space remains occupied until the patient departs. A discharged patient departs at treatment completion. An admitted patient remains in the same space, including a fast-track space, throughout boarding.

### 6.1 Deterministic dispatcher

After all state-changing events at a timestamp have been applied, the dispatcher runs to exhaustion:

1. assign waiting high-acuity patients to idle main spaces;
2. assign waiting moderate-acuity patients to remaining idle main spaces;
3. assign the oldest waiting low-acuity patients to idle fast-track spaces; then
4. assign remaining low-acuity patients to remaining idle main spaces.

Spaces within a resource pool are indistinguishable; the engine tracks counts rather than physical room identifiers. The dispatcher repeats until no eligible patient-resource pair remains. Consequently, after dispatch it is impossible for an eligible patient to be waiting while a compatible resource is idle.

Routing low-acuity patients to fast track first protects flexible main spaces for high- and moderate-acuity patients already present at that same timestamp. It does not reserve an idle main space for possible future arrivals.

## 7. Treatment and boarding duration distributions

### 7.1 Parent parameterization and spreads

Every nonzero stochastic duration starts from a median-parameterized lognormal parent distribution:

```text
Z ~ Normal(0, 1)
X_parent = exp(ln(m) + sigma * Z)
```

For the untruncated parent, `median(X_parent) = m`. The interface therefore labels `m` as the **parent median**, not the median of the bounded sample. A lognormal treatment-time distribution is an ED DES precedent [S2](./SOURCES.md#s2-hoot-et-al-2008); all medians, spreads, and bounds used here are synthetic project choices.

Treatment (main and fast track) uses the selected treatment-variability preset:

| Preset   | Log-scale SD `sigma_treatment` | Untruncated coefficient of variation |
| -------- | -----------------------------: | -----------------------------------: |
| Low      |                           0.35 |                   approximately 0.36 |
| Moderate |                           0.60 |                   approximately 0.66 |
| High     |                           0.85 |                   approximately 1.03 |

The coefficient of variation shown is `sqrt(exp(sigma^2) - 1)`. Nonzero boarding always uses `sigma_boarding = 0.75`, whose untruncated coefficient of variation is approximately 0.87. Changing the treatment-variability preset does not change boarding variability. These spreads represent within-scenario stochastic variation, not uncertainty about a fitted parameter.

### 7.2 True conditional truncation and exact inverse transform

Durations are sampled from the lognormal distribution **conditioned** to the declared interval `[L, U]`; they are not clipped/winsorized, and the sampler does not use rejection loops. For one uniform `u`:

```text
mu = ln(m)
a  = Phi((ln(L) - mu) / sigma)
b  = Phi((ln(U) - mu) / sigma)
p  = a + u * (b - a)
X  = exp(mu + sigma * Phi_inverse(p))
```

`u` is constrained to `(Number.EPSILON, 1 - Number.EPSILON)` before the transform. `Phi` is the fixed Abramowitz--Stegun 7.1.26 error-function approximation used by the implementation, and `Phi_inverse` is the fixed Acklam rational approximation. Their coefficients, branch points, and evaluation order are part of the model algorithm and may not change without a model-version change. This construction consumes exactly one stored patient uniform and has no point mass at either bound. Because conditioning can shift the distribution, the resulting bounded sample does not necessarily have median `m`, especially when `m` is near or outside a bound.

| Duration                        | Lower bound `L` |  Upper bound `U` |
| ------------------------------- | --------------: | ---------------: |
| Main treatment                  |           5 min |        1,440 min |
| Fast-track treatment            |           5 min |        1,440 min |
| Boarding when parent median > 0 |           1 min | 4,320 min (72 h) |

### 7.3 Main treatment-time scale

If the exact tier medians are `m_H`, `m_M`, and `m_L`, and the main treatment-time scale is `s`, the effective parent medians are:

```text
m_i,eff = s * m_i,  i in {H, M, L}
```

The default exact medians are 240, 180, and 90 minutes and `s = 1`. Validation must ensure each effective median is within the 5–1,440 minute treatment bound. The fast-track median is edited independently and is not multiplied by `s`.

### 7.4 Boarding duration

Boarding applies only to an admitted patient. If the configured boarding parent median is exactly zero, boarding duration is deterministically zero and the already stored boarding uniform is not transformed. Otherwise, boarding uses `sigma = 0.75` and the 1–4,320 minute bounds above.

In this model, treatment completion is the proxy for the disposition/admission decision. The boarding interval is therefore treatment completion to ED departure. This approximates the government technical report's concept of holding an admitted patient in the ED while awaiting inpatient transfer [S6](./SOURCES.md#s6-ahrq-2025), but it is not a CMS, Joint Commission, or institution-specific boarding measure. No threshold such as two or four hours is applied.

## 8. Admission model

Admission is a Bernoulli outcome conditional only on acuity. The default tier probabilities are:

```text
p_H = 0.45
p_M = 0.18
p_L = 0.03
```

At the default acuity mix, the displayed weighted rate is:

```text
A = 0.12(0.45) + 0.56(0.18) + 0.32(0.03) = 0.1644 = 16.44%
```

These probabilities are synthetic defaults. Published models support acuity-dependent Bernoulli admission as a modeling pattern [S2](./SOURCES.md#s2-hoot-et-al-2008), not these values.

### 8.1 Overall-admission slider

The canonical anchor vector is `b = (0.45, 0.18, 0.03)`. Synthetic tier caps are `c = (0.90, 0.60, 0.20)`. For a requested overall target `A*` and current acuity weights `w_i`, the app calculates:

```text
p_i(k) = min(c_i, k * b_i),  k >= 0
find k such that sum_i w_i p_i(k) = A*
```

The continuous monotone equation is solved deterministically by bisection to a probability tolerance of `1e-10`; if a plateau gives multiple solutions, choose the smallest `k` within tolerance. The feasible slider range is `0 <= A* <= sum_i w_i c_i`. Before a tier reaches its cap, relative risk ratios from the anchor vector are preserved; capped tiers remain fixed while the others continue increasing. At `A* = 0`, all tier probabilities are zero.

The tier probabilities are the actual simulation inputs. The overall rate shown in the interface is always recalculated as `sum_i w_i p_i`. If an acuity mix change makes a stored target infeasible, the app must ask for correction or visibly constrain it; it must not silently produce an unreachable target.

Advanced direct editing must reject probabilities outside `[0, 1]` and values above the declared tier caps. Returning to the overall slider re-enters scaled mode using the canonical anchor vector; that transition must be visible.

## 9. Randomness, reproducibility, and common random numbers

### 9.1 Reproducibility contract

The master seed is an integer in `1..2^32 - 1` stored with the scenario. A result is identified by at least:

```text
model/schema version
PRNG and distribution-algorithm versions
scenario parameters
master seed
replication count
```

For model/schema version 1, the normative random-number identifier is **`edts-prng-v1-mulberry32-mix32`** and the normative duration-transform identifier is **`edts-distributions-v1`**. These identifiers must appear in reproducibility metadata or be unambiguously implied by a versioned export schema. Changing the generator, seed mixer, stream tags, draw order, Poisson algorithm, normal approximations, or uniform-to-duration mapping requires a new algorithm or model version.

The same complete identifier must reproduce the same raw 32-bit random words exactly. On the same supported app/runtime version it must reproduce the same unrounded simulation output. Cross-browser conformance tests require exact integer streams and compare transcendental duration transforms to a declared numeric tolerance, because JavaScript engines need not round every `log`, `exp`, and `sqrt` identically. A **New seed** action chooses and displays a new valid master seed; loading or rerendering never changes it.

### 9.2 Fixed 32-bit generator and seed mixer

All operations below use unsigned 32-bit wraparound, logical right shift, bitwise XOR/OR, and 32-bit integer multiplication equivalent to JavaScript `Math.imul`. `u32(x)` means reduction modulo `2^32`.

```text
mix(x):
    x = u32(x)
    x = imul(x xor (x >>> 16), 0x21f0aaad)
    x = imul(x xor (x >>> 15), 0x735a2d97)
    return u32(x xor (x >>> 15))

deriveSeed(master, part_1, ..., part_n):
    s = mix(u32(master))
    for each part_i in order:
        s = mix(s xor mix(u32(part_i)))
    return s if s != 0 else 0x6d2b79f5

initialize(seed):
    state = u32(seed) if u32(seed) != 0 else 0x6d2b79f5

nextWord():
    state = u32(state + 0x6d2b79f5)
    z = state
    z = imul(z xor (z >>> 15), z or 1)
    z = u32(z xor u32(z + imul(z xor (z >>> 7), z or 61)))
    return u32(z xor (z >>> 14))

nextUniform():
    return nextWord() / 4294967296
```

Thus `nextUniform()` lies in `[0, 1)`. The nonzero seed guard is part of the algorithm even though imported scenario seeds must themselves be positive.

### 9.3 Stream keys and fixed draw mapping

The arrival tag is `0x415252`; absolute simulation hour `k` in replication `r` uses a fresh local stream seeded as:

```text
deriveSeed(masterSeed, 0x415252, r, k)
```

For hourly mean `q > 0`, the Poisson count uses the product algorithm with threshold `exp(-q)`: initialize `product = 1` and `count = 0`, then repeatedly increment `count` and multiply by `nextUniform()` while `product > exp(-q)`; return `count - 1`. If `q <= 0`, return zero without drawing. After the count is known, draw exactly that many additional uniforms from the same hour stream, multiply each by 60, and sort the offsets ascending. A new stream starts in every absolute hour, so draw consumption in one hour cannot shift another hour.

After the hourly lists have been concatenated in chronological hour order, each arrival receives a zero-based patient ordinal `j`. Its local stream is seeded with patient tag `0x504154`:

```text
deriveSeed(masterSeed, 0x504154, r, j)
```

Exactly four uniforms are drawn immediately in this fixed order:

1. acuity categorical variate;
2. treatment-duration inverse-CDF variate;
3. admission Bernoulli variate; and
4. boarding-duration inverse-CDF variate.

The fourth value is stored even for a patient who is discharged or when boarding median is zero; those cases simply do not transform it. Patient inputs are therefore independent of event execution order, capacity, queueing, and routing. Adding, removing, or reordering a patient draw is a model-version change.

### 9.4 Normative conformance vectors

Integer results in these vectors must match exactly. A listed uniform is the raw word divided by `2^32` and is shown only to aid diagnosis.

| Operation                                | Derived seed | First four raw `nextWord()` values               |
| ---------------------------------------- | -----------: | ------------------------------------------------ |
| `initialize(1)`                          |            1 | `2693262067, 11749833, 2265367787, 4213581821`   |
| `deriveSeed(20260831, 0x415252, 0, 0)`   |   2036032225 | `2312405730, 538637787, 3147352936, 3080807377`  |
| `deriveSeed(20260831, 0x504154, 0, 0)`   |    278027772 | `1331915774, 1762190320, 2457447237, 1473026535` |
| `deriveSeed(20260831, 0x504154, 7, 123)` |    642873659 | `985288489, 1450344597, 2782806137, 1331530683`  |

For example, the first arrival-stream word above gives `0.53839891450479627`, and the first four uniforms for patient `(r = 0, j = 0)` are `0.31011080695316195`, `0.41029190644621849`, `0.57216902193613350`, and `0.34296571626327932`.

The duration transform must also retain fixed numerical vectors. With the implementation's declared normal approximations, the following expected values are compared with absolute or relative tolerance `1e-12` on supported JavaScript engines:

| Call `(parent median, sigma, L, U, u)` |   Expected minutes |
| -------------------------------------- | -----------------: |
| `(180, 0.60, 5, 1440, 0.50)`           | 179.96420993521434 |
| `(240, 0.75, 1, 4320, 0.50)`           | 239.98687878555936 |
| `(90, 0.35, 5, 1440, 0.10)`            |  57.47020403964109 |
| `(240, 0.85, 5, 1440, 0.90)`           | 663.54700984761575 |

### 9.5 Paired A/B simulations

Scenario A and Scenario B use the same master seed and the same replication indices. When their demand assumptions are identical—same mean arrival rate, normalized hourly profile, and acuity mix—they share:

- the same arrival counts and arrival-time uniforms;
- the same acuity uniforms for corresponding arrivals;
- the same treatment inverse-CDF uniform for a corresponding patient;
- the same admission uniform; and
- the same boarding inverse-CDF uniform.

Each scenario transforms those shared variates using its own medians, variability, probabilities, resources, and routing. This is a common-random-number (CRN) paired design. It usually makes a within-replication difference less noisy by exposing both scenarios to the same synthetic day [S5](./SOURCES.md#s5-law-2015), [S8](./SOURCES.md#s8-yang-and-nelson-1991). It does not make the simulation deterministic, eliminate Monte Carlo error, or guarantee variance reduction for every metric.

If any demand assumption differs, the UI warns that the comparison combines demand and operational changes. Replication indices remain paired, but the app does not claim patient-level CRN alignment after the exogenous patient streams diverge.

An identical A/B scenario with the same seed must produce exactly zero paired deltas for every defined metric.

## 10. Event scheduling and simultaneous events

The future-event list is a min-priority queue ordered lexicographically by:

```text
(event time, event-type priority, insertion sequence)
```

Event-type priority is:

1. boarding completion;
2. treatment completion; and
3. arrival.

The engine removes **all** events at the next timestamp as one batch. It applies all boarding completions, then all treatment completions, then all arrivals. Events of the same type and time retain their stable insertion-sequence order. It runs the dispatcher only after the entire batch is complete. This means completion/release effects are applied before same-time arrivals, and every such arrival is present before dispatch. Heap layout cannot change the result because insertion sequence is an explicit final key.

Treatment completion has two branches:

- **Discharged:** set departure time to the completion time and release the space.
- **Admitted:** begin boarding immediately while retaining the same space. If boarding duration is zero, set departure to the same timestamp and release the space within the current batch; otherwise schedule a boarding-completion event.

After dispatch, every newly treated patient receives a treatment-completion event at `start + duration`.

Reporting bins are derived from the piecewise-constant state trajectory. They are not state-changing events and therefore cannot change queue order or resource assignment.

### 10.1 Engine pseudocode

```text
for replication r:
    initialize empty queues, resources, records, diagnostics, event heap
    generate and schedule all arrivals over [0, 2880)
    previousTime = 0

    while heap not empty and heap.minTime < 2880:
        t = heap.minTime
        integrate pre-event queue/occupancy/boarder state over [previousTime, t)
        batch = pop all events with time t

        process boarding completions by stable insertion sequence
        process treatment completions by stable insertion sequence
        process arrivals by stable insertion sequence
        dispatch eligible waiting patients to all compatible idle spaces

        assert invariants
        record post-dispatch change point
        previousTime = t

    integrate final state over [previousTime, 2880)
    compute analysis-window metrics
```

The integration operation clips every interval to `[1,440, 2,880)` before adding reported time or boarder-hours.

## 11. Metric definitions within one replication

### 11.1 Why different metrics use different event cohorts

A 24-hour window right-censors patients arriving near its end. Reporting only completed waits or LOS among analysis-period arrivals would bias results toward shorter cases. The model therefore uses **period-event cohorts**:

- wait metrics use patients whose **treatment starts** in the analysis window;
- LOS metrics use patients whose **departure occurs** in the analysis window; and
- arrival/departure counts use their respective events in the window.

These cohorts can include a patient who arrived during warm-up and exclude an analysis-period arrival who remains unfinished. This is intentional, produces fully observed durations, and must be disclosed in the methodology and exports. End-state metrics show the unfinished workload separately.

For any patient:

```text
wait = treatmentStart - arrival
treatment = treatmentCompletion - treatmentStart
boarding = departure - treatmentCompletion  (admitted only)

discharged LOS = wait + treatment
admitted LOS   = wait + treatment + boarding
```

“Wait” always means arrival-to-treatment-space start. It must never be labeled “door to provider,” because clinician resources are not modeled.

### 11.2 Summary metrics

| Metric                         | Exact within-replication definition                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Total arrivals                 | Count of arrival events in `[1,440, 2,880)`                                                                        |
| Departures per 24 h            | Count of departure events in `[1,440, 2,880)`; this is also “total departures” because the analysis window is 24 h |
| Still waiting at end           | Queue length at `2,880−`                                                                                           |
| Still occupying a space at end | Main plus fast-track occupancy at `2,880−`                                                                         |
| Patients remaining in system   | End waiting plus end occupying                                                                                     |
| Median wait                    | Median wait among treatment starts in the window                                                                   |
| 90th-percentile wait           | 0.90 quantile of the same treatment-start cohort                                                                   |
| Wait by acuity                 | Median and 0.90 quantile of that cohort, stratified H/M/L                                                          |
| Median ED LOS                  | Median LOS among all departures in the window                                                                      |
| Median discharged LOS          | Median LOS among discharged departures in the window                                                               |
| Median admitted LOS            | Median LOS among admitted departures in the window                                                                 |
| Average occupied spaces        | `integral O(t) dt / 1,440`, where `O` includes treatment and boarders                                              |
| Peak occupied spaces           | Maximum post-dispatch `O(t)` during the window, including the state at its start                                   |
| Time at/above 90% occupancy    | `100 * integral I[O(t) >= ceil(0.90 C)] dt / 1,440`                                                                |
| Peak queue length              | Maximum post-dispatch total queue during the window, including the state at its start                              |
| Total boarder-hours            | `integral B(t) dt / 60` over the window, where `B(t)` is admitted patients boarding in ED spaces                   |

Boarder-hours include only the portion of each boarding interval that overlaps the analysis window. There is no minimum-duration threshold. The metric is a model-defined resource-burden measure, not an externally reported quality measure.

Peak metrics use stable post-dispatch states; zero-duration intermediate states inside a same-time event batch do not count as peaks. Time averages are exact integrals of the piecewise-constant state, not averages of periodic snapshots.

### 11.3 Quantile convention

All within-replication and across-replication quantiles use linear interpolation equivalent to Hyndman-Fan type 7. For sorted observations `x[0]...x[n-1]` and probability `q`:

```text
h = (n - 1)q
j = floor(h)
g = h - j
Q(q) = (1 - g)x[j] + g*x[min(j + 1, n - 1)]
```

For one observation, every quantile equals that observation. For zero eligible observations, the metric is undefined and displayed/exported as `N/A`, never zero, `NaN`, or infinity.

## 12. Time-series aggregation

The 24-hour analysis window contains 96 nonoverlapping 15-minute bins. Within each replication and bin, the engine computes:

- exact arrival and departure counts;
- time-weighted mean total, main, and fast-track occupancy;
- time-weighted mean queue length;
- time-weighted mean boarder count; and
- optional within-bin post-dispatch maxima.

The system-status chart uses time-weighted means for occupied spaces and waiting patients, with the configured capacity as a constant line. The arrival/departure chart may sum four 15-minute counts into hourly counts. Aggregation must not substitute an end-of-bin snapshot for a time-weighted mean.

Across replications, each bin is summarized using the same median and 10th–90th percentile method as scalar metrics. Exports include bin boundaries, units, aggregation type, and unrounded values.

## 13. Monte Carlo aggregation and uncertainty

Every scalar metric is first computed separately within every replication. For each metric, the app reports:

- median of the defined replication values;
- empirical 10th percentile;
- empirical 90th percentile; and
- number of replications with a defined value.

If no replication has an eligible observation, the aggregate is `N/A`. Undefined replication values are excluded rather than converted to zero, and the valid-replication count is shown in methodology/export data.

The displayed 10th–90th range is a **between-replication stochastic interval conditional on fixed assumptions**. It is not:

- a confidence interval for a hospital mean;
- a prediction interval for a real ED;
- parameter uncertainty;
- evidence that the input assumptions are correct; or
- a causal effect estimate.

With 100 replications, the interval endpoints themselves have Monte Carlo error. Increasing replications improves numerical stability but does not make an uncalibrated model valid.

### 13.1 Scenario deltas

For paired scenarios, compute within replication:

```text
d_r = metric_B,r - metric_A,r
```

Then report the median, 10th percentile, and 90th percentile of the paired `d_r` values. Do not create a delta interval by subtracting the two marginal intervals.

Where a percentage change is mathematically appropriate and `metric_A,r > 0`:

```text
p_r = 100 * (metric_B,r - metric_A,r) / metric_A,r
```

Aggregate defined `p_r` values across replications and disclose the valid pair count. Percentage change is `N/A` when the baseline denominator is zero. Labels say only higher, lower, or unchanged; they do not imply that every increase or decrease is desirable.

The worker aggregates percentage changes in both directions directly from the paired replication values: `B` relative to `A`, and `A` relative to `B`. Swapping scenarios selects the already-aggregated reverse direction. It must not apply a nonlinear denominator conversion to an interval that has already been aggregated, because type-7 quantile interpolation and that conversion do not commute.

## 14. Sensitivity explorer

One-at-a-time sensitivity analysis changes one selected parameter over up to seven distinct valid values while holding all other scenario inputs fixed. A bounded integer parameter may yield fewer points when its valid domain is smaller; for example, fast-track allocation has five valid values when total treatment spaces equal five. Every point uses the same master seed and replication-index structure. The interface must disclose the replication count per point if it is lower than the main run.

Each outcome at each point uses the same within-replication definition and across-replication aggregation described above. The plot includes the median and 10th–90th percentile. CSV export includes the parameter value, replication count, seed, median, interval, and valid-replication count.

Every sensitivity result carries a stable key for the complete source scenario. Changing or switching the active scenario marks the prior sweep as a previous run until a matching sweep completes.

The interpretation must state that one-at-a-time analysis does not measure interactions among simultaneous changes and does not establish causality or real-world effectiveness.

## 15. Required invariants and validation oracles

The engine asserts or tests these properties:

Direct numeric entry is snapped to the control's declared step grid. Capacity, fast-track allocation, replication count, seed, and replication index must be integers. The app validates a reconstructed immutable scenario snapshot before cache lookup or worker dispatch, and the worker validates again before simulation.

### 15.1 State and capacity

- `0 <= mainOccupancy <= M`.
- `0 <= fastTrackOccupancy <= F`.
- `0 <= totalOccupancy = mainOccupancy + fastTrackOccupancy <= C`.
- `0 <= boarderCount <= totalOccupancy`.
- A space has at most one occupying patient and an occupying patient has exactly one space.
- High- and moderate-acuity patients never occupy fast-track spaces.
- After dispatch, no compatible resource is idle while an eligible patient waits.
- A boarding patient retains the same treatment space until departure.

### 15.2 Flow conservation and chronology

- At every stable post-dispatch state from an initially empty system: cumulative arrivals = cumulative departures + waiting + occupying.
- Event times removed from the heap are nondecreasing.
- `arrival <= treatmentStart <= treatmentCompletion <= departure`.
- A discharged patient's `departure = treatmentCompletion`.
- An admitted patient's `departure = treatmentCompletion + boardingDuration`.
- LOS decompositions in Section 11 hold within numeric tolerance.
- Every patient departs at most once; every resource is released at most once per occupation.

### 15.3 Randomness and aggregation

- Same model version, scenario, seed, and replication count produce identical results.
- Different seeds generally change at least one stochastic stream in a nondegenerate scenario.
- Identical A/B scenarios produce exactly zero paired deltas.
- Arrival profiles normalize to mean 1 within tolerance.
- No displayed/exported value is negative where prohibited, `NaN`, or infinite.
- Empty cohorts produce `N/A`; zero-arrival runs still produce numeric zero queue, occupancy, and departure counts.
- Warm-up events never enter analysis event counts or patient-event cohorts; state carried from warm-up does enter analysis integrals and can contribute later starts/departures.

### 15.4 Deterministic fixtures

At minimum, tests cover:

- zero arrivals;
- one patient, one space, deterministic durations;
- simultaneous release and arrivals across acuity tiers;
- zero boarding duration;
- a boarder spanning the analysis boundary;
- FIFO queue ties resolved by patient ID, while same-type event ties use stable insertion sequence;
- fast-track eligibility and capacity;
- strict main-space priority;
- exact time-integral calculations across 15-minute bins; and
- quantile/N/A edge cases.

The standalone release-gate fixtures, numerical oracles, generated-case checks, and evidence rules are in [VALIDATION.md](./VALIDATION.md). Verification establishes that the code implements this specification. It does not establish empirical validity. Validation principles and the need for data/context-specific validation are discussed by Sargent and in the ED DES validation review [S9](./SOURCES.md#s9-sargent-2013), [S10](./SOURCES.md#s10-doudareva-and-carter-2022).

## 16. Known limitations

1. **Synthetic and uncalibrated.** No default, preset, multiplier profile, truncation bound, or variability setting represents a hospital benchmark.
2. **Not a forecast.** Unlike calibrated ForecastED work [S2](./SOURCES.md#s2-hoot-et-al-2008), this app does not ingest operational data or predict a real ED.
3. **Treatment spaces are the only explicit capacity resource.** Clinicians, nurses, diagnostics, medications, transport, cleaning, hallways, and specialty teams are not modeled separately.
4. **Treatment time is composite.** A shorter duration cannot be attributed to a particular real process.
5. **Boarding is aggregate.** There is no inpatient bed system, unit matching, observation status, transport, environmental services, discharge process, or transfer network.
6. **Simplified clinical heterogeneity.** Three operational tiers do not reproduce ESI or another validated triage scale. There are no diagnoses, deterioration, reassessment, mortality, return visits, or treatment outcomes.
7. **No abandonment or diversion.** All arrivals remain queued until treated; no one leaves without being seen.
8. **Strict nonpreemptive priority.** Low-acuity starvation is possible in overload, and high-acuity care has no dedicated resuscitation resource.
9. **Independence assumptions.** Conditional on configured tier and time of day, arrival, duration, admission, and boarding draws lack many real correlations and feedback loops.
10. **Poisson arrivals.** Independent increments may underrepresent bursts, clustering, seasonality, weekdays, epidemics, or event-driven demand.
11. **Conditionally truncated lognormals.** Bounds remove the parent distribution's tails and can shift the bounded median and mean materially at extreme settings.
12. **Initialization and horizon.** A 24-hour warm-up and 24-hour analysis may be too short, especially in unstable scenarios. There is no automatic steady-state test.
13. **Period-event cohorts.** Wait, LOS, arrivals, and departures intentionally refer to different event cohorts; they should not be combined as if they followed one admission cohort.
14. **Finite Monte Carlo error.** A 10th–90th replication range reflects only modeled stochastic variation under fixed inputs.
15. **Scenario comparison is conditional.** CRN improves paired numerical comparison when demand matches, but simulation deltas do not establish a real intervention effect.
16. **Fast track is a resource-allocation abstraction.** Reallocating rooms does not represent staff skill, physical layout, diagnostic access, or implementation cost.

## 17. Interpretation boundary

Acceptable interpretation:

> Within this synthetic model and the selected assumptions, Scenario B had a lower median wait for a treatment space, while its paired boarder-hour distribution was similar to Scenario A.

Unacceptable interpretation:

> This hospital should implement Scenario B; it will improve patient outcomes.

Results support exploration and hypothesis generation only. Real operational use would require institution-specific data governance, conceptual-model review with stakeholders, input fitting, code verification, face validation, historical validation, sensitivity and initialization analyses, and prospective evaluation.

## 18. Source boundary

The claim-to-source map, complete citations, identifiers, and links are in [SOURCES.md](./SOURCES.md). In brief:

- [S1](./SOURCES.md#s1-asplin-et-al-2003) supports the input-throughput-output conceptual organization.
- [S2](./SOURCES.md#s2-hoot-et-al-2008)–[S4](./SOURCES.md#s4-connelly-and-bair-2004) provide ED DES precedents, not app parameter values.
- [S6](./SOURCES.md#s6-ahrq-2025) provides a government technical-report boarding definition and system-output framing.
- [S5](./SOURCES.md#s5-law-2015) and [S7](./SOURCES.md#s7-grassmann-2014)–[S10](./SOURCES.md#s10-doudareva-and-carter-2022) support general simulation experiment design, CRN, warm-up reasoning, and verification/validation.
