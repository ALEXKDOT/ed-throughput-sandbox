# ED Throughput Visualizer: model-v2 specification

## Status and intended use

Model v2 powers the separate **Visualizer** workspace. It is a synthetic, client-side discrete-event simulation for patient and resource replay and scenario comparison. It is not calibrated to an institution, is not a forecasting model, and must not be used for clinical, staffing, regulatory, or operational decisions.

The released Sandbox model remains model/schema v1. V2 has separate types, validation, persistence, random streams, worker messages, event logic, results, and replay traces. A v1 scenario is not silently treated as a v2 scenario because its three operational tiers, capacity semantics, and composite service model are materially different.

## 1. Simulation horizon and results

Each default replication begins with a 24-hour warm-up and then observes a seven-day half-open interval `[0, 10,080)`. The visible replay begins at analysis minute 0 and includes active patients carried in from warm-up.

The Visualizer intentionally presents two different data products:

1. **Representative trajectory.** One completed replication is selected deterministically and rerun with trace recording. Patient dots, resource states, the clock, current census, and patient event inspection all describe this one trajectory.
2. **Replication summary.** Summary measures and hourly uncertainty bands are calculated across all configured replications. Displayed ranges are the 10th–90th percentile across replications, not confidence intervals.

The representative animation never substitutes for the repeated-run results.

## 2. Synthetic patient identity and state

A synthetic v2 patient contains only operational attributes:

- deterministic synthetic ID;
- arrival minute and arrival mode (`walkIn` or `ambulance`);
- Emergency Severity Index level 1–5;
- generic complaint pathway (`minorInjury`, `medical`, `abdominal`, or `behavioralHealth`);
- assigned treatment resource and active service resource, when any;
- exactly one physical location;
- a set of zero or more concurrent operational statuses;
- service and queue timestamps; and
- synthetic disposition.

There are no names, demographics, free text, diagnoses, clinician identities, notes, or real patient records.

Physical location is independent from status. For example, a patient can remain physically in a main room while awaiting lab results. During CT, MRI, X-ray, or ultrasound, the patient moves to the imaging location while the assigned ED treatment space changes from occupied to reserved and cannot be reassigned.

The implemented status vocabulary includes awaiting triage, room, clinician, orders, specimen collection, lab results, imaging, reassessment, discharge, admission decision, inpatient bed, and transport. Multiple statuses may be present simultaneously.

## 3. Locations and individual resources

The generic schematic contains institution-neutral intake, care, diagnostic, and outflow locations:

- walk-in entrance and ambulance arrival;
- triage and an uncapped waiting census;
- trauma, main treatment, additive fast track, hallway treatment, behavioral health, and an observation scaffold;
- CT, MRI, X-ray, ultrasound, and laboratory;
- an uncapped boarding census and discharge lounge; and
- a visibly locked inpatient-destination placeholder.

Capacity is represented by addressable resource units rather than aggregate counters. Current unit kinds include triage spots, main rooms, fast-track spaces, hallway beds, trauma bays, behavioral-health spaces, scanners/rooms, lab processors, discharge seats, and off-room boarding spaces. The waiting and boarding census are not configured resource capacities.

The illustrative baseline uses two CT scanners and four lab processors. These values replaced the original one-CT/two-lab setup after a same-arrival-stream stress check showed that the original laboratory demand exceeded modeled processing capacity and created an artificial week-over-week backlog. The revised defaults are a stable educational starting point, not a staffing or equipment recommendation.

The map uses deterministic adaptive grids with separate resource and patient bands. The map and census inspector render every active patient rather than truncating at a fixed count. For operational readability, patients awaiting triage or a treatment space are grouped visually in the waiting zone, and all admitted patients awaiting an inpatient bed are grouped in the boarding-census zone. This display grouping does not alter a patient's modeled physical location or resource ownership; the inspector and trace retain that underlying state. The boarding zone therefore distinguishes boarders in off-room spaces from boarders still holding care spaces.

Runtime resources have an operational state and an ownership state. Current runs produce available, occupied, and reserved states. Closed and blocked are typed and render-ready but are not reachable until scheduled closure/dirty-resource semantics are implemented. Occupied and reserved resources have at most one owning patient. Dirty/cleaning semantics are deferred because environmental-services activity is not yet modeled.

The observation location is intentionally scaffolded but has no active routing rule in this version. Validation therefore requires observation capacity to remain zero and rejects scheduled observation-capacity additions. The location stays visible so later pathway work has an explicit destination without implying that observation behavior is already modeled. Every diagnostic service that can be generated requires at least one corresponding resource; configurations with zero MRI or ultrasound capacity are rejected rather than allowed to gridlock silently.

## 4. Patient flow

### 4.1 Arrival and triage

Arrivals are generated as independent one-minute Poisson increments with uniformly distributed within-minute timestamps. The rate follows the repeating 24-hour piecewise-constant profile, whose 24 multipliers must average 1.0, with scheduled arrival changes taking effect at their exact whole-minute boundary. This construction preserves all pre-intervention arrivals and makes a multiplier-one intervention a true no-op. Each patient enters the triage priority queue. A keyed subset receives a synthetic leaving-without-being-seen deadline; patients without that draw can remain queued through the modeled horizon.

Triage and all subsequent queues use ESI 1 before 2 before 3 before 4 before 5. Ties within ESI use queue-entry time, then patient ID. Service already in progress is not preempted.

### 4.2 Treatment-space routing

Treatment-space eligibility follows these rules:

- ESI 1 prefers trauma, then main treatment, then hallway treatment.
- ESI 2 prefers main treatment, then trauma, then hallway treatment.
- ESI 3 uses main or hallway treatment.
- ESI 4–5 prefer fast track, then main or hallway treatment.
- The behavioral-health pathway prefers a behavioral-health space, then main or hallway treatment.

Fast-track capacity is additive in v2. It is not carved out of the main-room count as it is in model v1.

Patients who have completed triage wait in one unbounded treatment queue. There is no 24-patient threshold, overflow location, or other queue-capacity limit. The queue can therefore exceed 100 patients and preserve waits longer than 12 hours in sufficiently overloaded synthetic scenarios. Physical treatment resources remain finite and determine how quickly the queue clears.

### 4.3 Diagnostics and reassessment

Generic pathways probabilistically request lab, CT, MRI, X-ray, and/or ultrasound. Each diagnostic resource has its own constrained nonpreemptive ESI/FIFO queue. Lab processing occurs while the patient remains in the treatment location. Imaging moves the patient to the diagnostic location and reserves the treatment resource until return. Diagnostics are processed sequentially in this version, followed by reassessment.

Treatment and diagnostic durations use a conditional truncated lognormal transform driven by patient/stage-keyed uniforms. Non-boarding services are bounded to 1–1,440 minutes; aggregate inpatient delay is bounded to 1–4,320 minutes. The global care-duration scale applies to triage, treatment, diagnostics, reassessment, and discharge-lounge time, but deliberately does not alter inpatient delay. Initial-treatment medians are configurable by ESI and can be multiplied by a configurable minor-injury, medical, abdominal, or behavioral-health pathway factor. These are stage inputs, not direct total-length-of-stay targets; total LOS emerges from all queues and stages. Numerical defaults are illustrative synthetic parameters.

Pathway assignment remains a fixed synthetic rule, not a fitted clinical model. Behavioral health is assigned to 8% of arrivals. Among ESI 4–5 arrivals, minor injury accounts for the next 44%; among ESI 1–3, it accounts for the next 20%. Abdominal accounts for the next 10% or 34%, respectively, and the remainder is medical. Diagnostic-order probabilities are configurable in the advanced setup. Defaults are lab at 86% for abdominal, 70% for medical, 32% for behavioral health, and 12% for minor injury; X-ray at 68% for minor injury; CT at 52% for ESI 1–2 medical, 30% for other medical, and 46% for abdominal; ultrasound at 34% for abdominal; and MRI at 4.5% for medical and behavioral health. Selected services run sequentially in the fixed generated order.

The setup panel shows an approximate diagnostic-capacity check. For each modality it combines mean arrivals, the current ESI/pathway mix, diagnostic-order probabilities, configured capacity, the global duration scale, and the untruncated lognormal mean factor. It labels 85%–99% approximate utilization as tight and 100% or more as overloaded. This is a pre-run warning that intentionally ignores peak-hour transients, truncation, queue interactions, and treatment-space blocking; run the simulation to calculate queues and patient outcomes.

### 4.4 Disposition, discharge, and boarding

Disposition probabilities depend on ESI. The model includes discharge, admission, transfer, death, leaving without being seen (LWBS), leaving before treatment completion (LBTC), and elopement. ESI 1 has a 1.2% synthetic death threshold; ESI 1–2 has a 3.5% cumulative transfer threshold before the configured admission threshold is applied to the same deterministic draw. Synthetic LWBS eligibility is 0.2%, 1%, 4%, 10%, and 16% for ESI 1 through 5. Eligible patients receive a keyed 75%–250% multiplier on a 24-, 16-, 12-, 10-, or 8-hour base, respectively; all other untreated patients remain in the queue. ESI 4–5 patients with a 1.2% exit-risk draw receive a five-hour LBTC deadline after treatment begins; admitted patients with a 0.3% draw receive an eight-hour elopement deadline. These deliberately simple hazards are not clinically fitted risks.

Discharged patients move to an available discharge-lounge seat, releasing the original treatment space. If the lounge is full, the patient remains discharge-pending in the original space.

An admitted patient moves to an available off-room boarding space and releases the original treatment space. If no off-room space is available, the patient remains in and blocks the assigned treatment space. The total boarder census and the queue for an off-room space have no configured count limit; `boardingBeds` controls only how many boarders can release their treatment spaces. A stochastic aggregate inpatient delay ends boarding and moves the patient out of the modeled ED. Inpatient units, placement logic, transport resources, and downstream bed matching are not simulated.

## 5. Event ordering and interventions

The engine advances directly to the next event. Events at one timestamp are processed in this order:

1. service completions and releases;
2. exit deadlines;
3. scheduled intervention changes;
4. arrivals; and
5. one exhaustive dispatch across all queues.

Insertion sequence is the final tie-break. A trace frame is emitted only after the full batch and dispatch, so the replay does not expose zero-duration intermediate overcapacity.

The v2 contract supports scheduled capacity additions, arrival-rate scaling, service-duration scaling, and boarding-duration scaling. Intervention times are whole minutes in the half-open simulation window; a change at the terminal boundary is rejected because it would have no analytic exposure. Validation allows at most 100 interventions and 20 actions per intervention, caps cumulative resources at 80 per kind and 300 total, keeps cumulative service/boarding scale factors within 0.05×–10× (including their combined boarding effect), and limits the configured peak arrival rate to 150 per hour before work reaches the simulation worker. The current scenario settings panel applies combined scenario changes for the whole rerun. Interactive mid-replay branching and scheduled opening/closing controls remain deferred.

## 6. Random streams and paired comparison

V2 uses separately tagged keyed random streams. Exogenous attributes are keyed by master seed, replication, patient ordinal, attribute/stage tag, and occurrence. Capacity or routing changes therefore do not shift later patient draws merely because the event order diverges.

All A/B runs require the same seed, replication count, warm-up, and analysis window. When A and B also have identical demand and arrival-scaling assumptions, they share the same synthetic arrivals and patient attributes. Paired deltas are formed within replication as `B - A` before percentile aggregation. If demand differs, the UI labels the comparison as replication-level only and warns that the effect cannot be attributed to capacity in isolation.

The model-v1 four-draw patient stream is unchanged.

## 7. Representative replication and exact replay

The worker first runs compact summaries for every replication. It selects the replication with the lowest squared standardized distance from ensemble medians across door-to-room time, ED length of stay, boarder-hours, waiting patient-hours, and departures. In paired mode, the score includes both scenarios and the same replication index is used for A and B. Ties resolve to the lowest replication index.

Only the selected replication is rerun with trace recording. The trace contains:

- ordered stable timestamp frames;
- labeled patient events;
- patient/resource state patches;
- an analysis-start checkpoint;
- periodic checkpoints approximately hourly and at analysis end;
- final metrics and peak-census minute; and
- seed, scenario digest, model/trace version, replication ID, and selection provenance.

Scrubbing or rewinding restores the nearest preceding checkpoint and folds immutable patches forward. Queue changes dirty the affected resource snapshots, while active wait and length-of-stay clocks are derived at the requested replay minute between event frames. It does not reverse-simulate or approximate prior modeled state. Previous/next-event controls move between stable trace frames; both panes in side-by-side mode share one clock. Entity selection is scenario-scoped so an unpaired patient ID in one pane is never silently presented as the patient with the same ordinal in the other.

## 8. Metrics

Current ensemble summary measures and cohorts are:

- **Median door-to-treatment-space time:** waits observed when treatment starts in `[0, analysis end)`, including warm-up arrivals that start treatment in the analysis window. Patients still waiting at the end are not imputed.
- **Median ED length of stay:** stays observed for departures in `[0, analysis end)`, including warm-up arrivals that depart in the window. Patients still active at the end are right-censored and excluded from this median.
- **Total boarder-hours:** exact event-to-event integral of admitted-awaiting-inpatient-bed census over the analysis window, divided by 60.
- **Waiting patient-hours:** exact event-to-event integral of the full triage-plus-treatment waiting census over the analysis window, divided by 60. No display or capacity threshold is subtracted.
- **Departures:** all departure events in the analysis window, with disposition counts retained per replication.
- **Peak ED census and peak waiting census:** maxima of the analysis-start state and every stable post-batch/post-dispatch state. Waiting is triage queue plus treatment queue.
- **Median constrained-diagnostic queue delay:** queue-entry-to-service-start waits observed when CT, MRI, X-ray, ultrasound, or lab starts at or after minute 0.

Hourly status bands are pre-event snapshots at 60-minute boundaries and include census, total waiting, occupied treatment spaces, diagnostic queue, total boarders, and cumulative departures. Each reported interval is the empirical 10th, 50th, and 90th percentile across finite replication values. KPI cards use the representative state as the primary value and label the ensemble range separately. Clicking a KPI jumps the replay to that measure's ensemble peak period, or to representative peak census when no time-series analogue exists.

Representative selection uses door-to-room, LOS, boarder-hours, waiting patient-hours, and departures. For each metric, distance from the ensemble median is divided by the empirical p90–p10 spread (with `1e-9` as the zero-spread floor), squared, and summed. A missing metric contributes a fixed penalty of 4. Paired selection sums the two scenario scores, and ties choose the lowest replication index.

## 9. Current limitations and deferred work

- No staffing, rota, skill, clinician, cost, or environmental-services model.
- No institution calibration, data ingestion, live census, forecasting, or operational recommendation.
- The diagnostic-capacity check is a steady-state warning, not a queueing forecast or staffing target.
- No patient deterioration, preemption, specialty eligibility, isolation, age, or other clinical constraint.
- Generic complaint pathways are illustrative and diagnostics are sequential.
- Observation behavior, inpatient-unit matching, vertical/waiting-room treatment, and overflow triage are not active.
- Outcome filtering/stratification by ESI, arrival mode, disposition, pathway, or time is deferred; current breakdowns are system-level except per-replication disposition counts.
- Resources do not yet have separate minimum/design/maximum capacity semantics.
- No drag-and-drop/floorplan authoring or institution template editor yet.
- No mid-replay branch from an opaque current state; users change assumptions and rerun from the same seed.
- Resource closing/dirty workflows are typed for later work but not exposed as current scenario settings.
- The Visualizer is intentionally desktop-first. The released Sandbox remains responsive on small screens.
- Sandbox v1 deliberately retains its historical three operational tiers. Migrating the basic editor to actual ESI 1–5 is a separate schema decision rather than part of this v2 workspace release.

These boundaries are product safeguards, not missing disclaimers to be removed later. Any claim of institutional usefulness would require governed data, fitted inputs, calibration, external validation, workflow review, and prospective evaluation.
