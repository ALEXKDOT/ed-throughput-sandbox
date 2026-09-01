# Portfolio language

All descriptions below are intentionally bounded. Attribution is resolved to Alexander Krawec; do not add claims of hospital adoption, patient impact, empirical forecasting accuracy, or measured operational improvement unless separately documented with evidence.

## 150-character description

Built a browser-based, seeded simulation for exploring synthetic emergency-department flow, capacity, boarding, and scenario tradeoffs.

## 300-character description

Designed and built ED Throughput Sandbox, a browser-based discrete-event simulation that lets users test synthetic ED demand, treatment-capacity, admission, boarding, and fast-track assumptions, compare seeded scenarios, and inspect uncertainty—without patient data or a backend.

## ERAS-style description (maximum 750 characters)

I designed and built ED Throughput Sandbox, an open-source educational web app for exploring emergency-department flow as a systems problem. I translated the input–throughput–output framework into a transparent client-side discrete-event simulation with seeded Poisson arrivals, acuity-priority queues, constrained spaces, lognormal treatment and boarding durations, Monte Carlo uncertainty, paired comparison, and sensitivity analysis. I added deterministic fixtures, resource and chronology invariants, responsive-browser and accessibility tests, source/model documentation, and a static deployment workflow. It uses synthetic assumptions and is not a validated forecast, staffing tool, or substitute for institution-specific analysis.

## CV résumé bullets

- Designed and implemented an open-source React/TypeScript discrete-event simulation for exploring synthetic emergency-department demand, capacity, treatment duration, admission pressure, boarding, and fast-track scenarios.
- Built a reproducible Monte Carlo/paired-comparison workflow with versioned random streams, Web Worker execution, invariant and browser tests, accessible visualizations, validated import/export, and transparent model/source documentation.

## LinkedIn / GitHub launch paragraph

I built ED Throughput Sandbox, an open-source browser application for exploring how emergency-department demand, treatment capacity, care duration, admission pressure, and boarding can interact in a simplified operational model. It runs seeded discrete-event simulations entirely in the browser, reports uncertainty across repeated runs, supports paired scenario comparison and sensitivity analysis, and documents its event logic and evidence boundaries. It uses synthetic assumptions and no patient data; it is an educational systems-thinking project, not a hospital forecast or staffing recommendation tool.

## 30-second interview explanation

ED Throughput Sandbox is a browser-based discrete-event simulation I built to make emergency-department crowding easier to reason about as a system. Users change synthetic arrivals, acuity, treatment spaces, durations, admission, and boarding, then compare repeated seeded simulations with uncertainty. The key lesson is that input, throughput, and output constraints interact. I was careful to document that the model is educational, simplified, and not calibrated to a real hospital.

## 90-second interview explanation

I wanted a concrete way to connect my interest in emergency care with systems thinking, so I built ED Throughput Sandbox. The model treats patient flow as discrete events: synthetic patients arrive according to an hourly Poisson process, join a strict acuity-priority/FIFO queue, occupy an eligible treatment space for a skewed duration, and either depart or continue occupying that same space while boarding. A 24-hour warm-up reduces empty-system initialization bias, and the next 24 hours are repeated with deterministic child seeds so the app can report median results and uncertainty. Scenario A and B share random streams where practical, which makes operational deltas less noisy. I separated the simulation engine from React, moved Monte Carlo work into a Web Worker, added invariant and deterministic tests, and documented every consequential assumption and source boundary. The honest limitation is equally important: it omits many real resources and feedback loops and has no institution-specific validation, so it supports learning and hypothesis generation—not operational decisions.

## Likely technical interview questions

### 1. Why discrete-event simulation instead of a spreadsheet or continuous equation?

Arrivals, queueing, resource seizure/release, treatment completion, and boarding are event-driven and state-dependent. DES preserves individual timing and resource contention without updating every simulated minute. A spreadsheet can summarize averages but does not naturally represent priority queues, simultaneous releases, or a boarder retaining a specific capacity unit.

### 2. How is reproducibility implemented?

The app fixes a versioned 32-bit generator and seed mixer. Each replication gets deterministic hour-level arrival streams and patient-level attribute streams keyed from the master seed. Exact raw-word test vectors protect the algorithm. The same scenario, model version, and seed therefore reproduce the same stream and result on the supported runtime.

### 3. What are common random numbers, and why use them?

Scenario A and B use the same replication indices and corresponding arrival/patient uniforms when their demand structure matches. Each scenario transforms those variates with its own resources and duration assumptions. Comparing within-replication differences can reduce noise because both scenarios experience the same synthetic day; it does not eliminate Monte Carlo uncertainty or guarantee variance reduction for every metric.

### 4. How do you prevent occupancy from exceeding capacity?

Only the dispatcher starts treatment. It checks separate main and fast-track counters against their configured capacities, routes only eligible patients, and increments a resource counter at treatment start. A discharge or boarding completion decrements exactly the patient's recorded space type. Deterministic fixtures and generated invariant tests assert both counters after the run.

### 5. How did you keep the UI responsive and imports safe?

Monte Carlo and sensitivity work run in a module Web Worker; cancellation terminates the worker and invalidates its run ID so stale partial output cannot publish. Imports are capped at 64 KB, parsed without dynamic code, and reconstructed field-by-field with version, enum, finite-number, probability, duration, capacity, and string checks. Unknown keys are ignored rather than merged.

## Likely healthcare-systems interview questions

### 1. What does the input–throughput–output framework add?

It prevents crowding from being reduced to one cause. Demand and acuity are inputs; treatment resources and processes shape throughput; admission and boarding constrain output. The model makes those interactions visible while acknowledging that the categories are a conceptual simplification.

### 2. What does “treatment duration” mean here?

It is a composite operational interval covering the modeled effect of examination, clinician availability, diagnostics, treatment, reassessment, and disposition work. The app does not simulate those resources separately, so its wait must not be called door-to-provider time and its treatment duration must not be interpreted as one clinical process.

### 3. Why can boarding affect incoming patients?

In the model, an admitted patient continues occupying the same ED treatment space until the boarding interval ends. That reduces capacity available to the queue even though treatment is complete. This captures the capacity mechanism without pretending to model the inpatient bed system or the causes of boarding.

### 4. What would be required before using this at a hospital?

A governed use case, deidentified and well-defined data, stakeholder review of the conceptual model, institution-specific input fitting, calibration on a training period, independent validation days, sensitivity and rare-overload analysis, documented error criteria, and ongoing drift monitoring. The current synthetic defaults should not be reused as estimates.

### 5. What is the most important model limitation?

Real EDs have interacting clinicians, diagnostics, rooms, resuscitation capacity, observation pathways, reassessment, deterioration, inpatient services, and behavioral feedback that are absent here. Strict priority and aggregate duration assumptions can also distort waits. The app is useful for systems learning precisely because these boundaries are explicit; it is not a validated representation of any institution.
