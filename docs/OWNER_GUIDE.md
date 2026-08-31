# Owner guide

This guide is the minimum conceptual preparation for describing ED Throughput Sandbox publicly. Read the normative [model specification](./MODEL.md) and [source map](./SOURCES.md) before making detailed claims.

## The short, accurate framing

The project is a browser-based educational discrete-event simulation of simplified emergency-department flow. It uses synthetic aggregate assumptions and no patient data. It demonstrates how input, throughput, and output constraints can interact; it does not predict a hospital, recommend staffing, or establish that an intervention works.

## Why discrete-event simulation was selected

The system changes when something happens: a patient arrives, treatment finishes, or boarding finishes. Those events change queues and resource occupancy. DES jumps directly from event to event, so it represents contention and timing more faithfully than applying one daily average. It is also more efficient than checking every simulated minute when nothing changes.

DES is a method, not evidence of validity. A technically correct engine can still be a poor representation of a real ED if its boundaries or inputs are wrong.

## How the event queue works

The engine stores future events in a binary min-heap ordered by timestamp, event priority, and insertion sequence. At a timestamp, it batches all events and applies:

1. boarding completions, which release the occupied space;
2. treatment completions, which either release a discharged patient's space or begin boarding in the same space;
3. arrivals, which enter an acuity-tier FIFO queue; and
4. one exhaustive dispatcher, which fills every compatible idle resource.

The main dispatcher selects high before moderate before low acuity and FIFO within a tier. Fast-track spaces are eligible only for low acuity. Low acuity uses idle fast track before spare main capacity, so compatible resources do not remain idle while an eligible patient waits.

## How random sampling works

### Arrivals

Each hourly profile multiplier is normalized so the 24-hour mean is one. For every simulated hour, the model samples a Poisson count with mean `arrival rate × hourly multiplier`, then gives that many arrivals sorted random offsets within the hour. This is a piecewise-constant nonhomogeneous Poisson process, not evenly spaced arrivals.

### Acuity, admission, and durations

A uniform draw selects one of three acuity tiers from their cumulative probabilities. Another uniform draw is compared with the selected tier's admission probability. Treatment and positive boarding durations are sampled from a conditional truncated lognormal distribution. The user sees the parent median; a log-scale sigma controls skew/variability; explicit lower and upper bounds prevent pathological values.

A boarding median of zero is handled as exact zero. It never calls `log(0)` and releases the space once at treatment completion.

### Seeds and streams

The master seed is visible. A fixed integer mixer derives child streams by replication/hour for arrivals and by replication/patient ordinal for attributes. Changing event order therefore does not consume a different shared sequence for later patients. The algorithm has committed raw-word vectors; changing it requires a version change.

## Why the warm-up exists

Starting at midnight with an empty ED creates an artificial low-occupancy period. The model first runs 24 hours without reporting, allowing queues, treatment, and boarding to carry into the analysis day. It then reports the next 24 hours. Warm-up state is retained, but warm-up arrivals, starts, departures, and state-time are not counted as analysis events.

One day is a pragmatic educational warm-up, not proof of steady state. Highly overloaded scenarios may retain initialization effects or grow without stabilizing.

## How capacity and boarding interact

A patient occupies one eligible space during treatment. A discharged patient releases it at treatment completion. An admitted patient keeps the same space for the sampled boarding interval and releases it only when boarding finishes. Consequently, a long output delay can reduce capacity available to new arrivals even when treatment processes are unchanged.

The model does not simulate an inpatient bed queue. Boarding duration is an aggregate output constraint, so the app cannot say why boarding occurred or which hospital process should change.

## How metrics are aggregated

Each replication produces its own summary metrics. For example, it computes that replication's median wait, 90th-percentile wait, average occupancy, and boarder-hours. Only then does the app aggregate the same metric across replications and display the median plus 10th–90th percentile interval.

It does **not** pool all patients from all replications into one large sample. Pooling would overweight replications with more observations and would not represent simulation-to-simulation variation. Empty eligible cohorts remain `N/A`; each aggregate stores its valid replication count.

Status charts divide the analysis day into 96 exact time-weighted 15-minute bins. Arrival/departure charts count events hourly. “Wait” means arrival to treatment-space assignment, not door to provider.

## How common random numbers help A/B comparison

Scenario B is run with Scenario A's master seed and the same replication IDs. When demand assumptions match, corresponding synthetic patients share arrival, acuity, service-duration, admission, and boarding uniforms. Scenario settings transform those common values differently.

The app calculates `B − A` inside each replication and then aggregates the deltas. This pairing often removes noise from comparing two unrelated synthetic days. It does not make a causal real-world estimate, eliminate stochastic variation, or guarantee every result becomes less variable.

If demand differs, corresponding patient ordinals no longer represent the same arrival process, so the UI warns that both demand and operational changes contribute to the comparison.

## Where the model is intentionally simplified

- Three operational acuity tiers; no deterioration, reassessment, or preemption.
- Treatment spaces are the only explicitly constrained treatment resource.
- Treatment duration combines clinician, diagnostic, treatment, reassessment, and disposition effects.
- No clinician teams, diagnostic queues, resuscitation bays, observation unit, or specialty routing.
- Admission is a tier probability, not a clinical decision model.
- Boarding is one duration, not an inpatient bed, transport, cleaning, or placement system.
- No walkouts, ambulance diversion, balking, feedback from waits to arrivals, or day-to-day dependence.
- Strict priority can create severe low-acuity waits in overload.
- Synthetic defaults do not encode a real ED and are not literature benchmarks.

## How to change defaults

Preset/default configurations are in `src/presets/scenarios.ts`. Hourly profile vectors are in `src/presets/profiles.ts`. A consequential change should include:

1. a documented rationale in `docs/DECISIONS.md`;
2. a source boundary in `docs/SOURCES.md` if the rationale cites evidence;
3. updated validation ranges when needed;
4. deterministic or invariant tests; and
5. a model/schema or algorithm version change if output behavior changes.

Do not replace a synthetic default with a number from one paper and call it representative. Parameter transfer requires checking setting, population, definitions, censoring, and dependence.

## How clinician teams could be added later

A credible extension would introduce a second resource pool rather than burying clinician availability inside treatment duration:

1. define team types, eligibility, schedules, and seizure/release semantics;
2. decide whether a patient needs a space and clinician simultaneously or in stages;
3. add events for clinician assignment/release and any diagnostic waits;
4. specify deadlock-free dispatch when multiple resources are needed;
5. fit or clearly label synthetic team service assumptions;
6. add invariants for each pool and deterministic contention fixtures; and
7. reconsider what “wait” and “treatment duration” mean in the UI and documentation.

The difficult part is conceptual validity and timestamp semantics, not adding a counter to the code.

## How to explain AI-assisted development honestly

A suitable statement is:

> I directed the product, modeling, design, implementation, testing, documentation, and release process with AI-assisted development tools. I reviewed the model contract, source boundaries, event logic, generated tests, and final behavior, and I can explain the architecture and limitations. The project should be evaluated as my designed and reviewed artifact, not as evidence that every line was typed without assistance.

Do not claim independent authorship of work you did not perform. Be prepared to explain why each major decision exists, reproduce tests, trace a metric from UI to engine, and identify what you would validate before any real-world use.

## Final pre-interview checklist

- Explain the input–throughput–output framework without claiming it validates the app.
- Draw the event order and resource lifecycle on paper.
- Explain why a boarder still blocks an ED treatment space.
- Distinguish within-replication metrics from across-replication uncertainty.
- Explain seed derivation and common random numbers at a conceptual level.
- State the event-cohort definitions and warm-up boundary.
- Name at least five omitted real-world resources or feedback loops.
- Say “hypothesis generation,” not “proved improvement.”
- Know how to run the quality gates and where model defaults live.
- Disclose AI assistance in a way that matches the work you actually reviewed and understand.
