# Portfolio language

All descriptions below are intentionally bounded. Each independently distinguishes Alexander Krawec's product conception and design, his simulation-model design, and the AI-assisted software implementation he directed and reviewed. Do not add claims of hospital adoption, patient impact, empirical forecasting accuracy, or measured operational improvement unless separately documented with evidence.

## 150-character description

Conceived and model-designed a synthetic ED flow sandbox; directed AI-assisted implementation. No institutional validation or measured impact.

## 300-character description

I conceived and designed ED Throughput Sandbox and its synthetic discrete-event model, then directed and reviewed AI-assisted software implementation. It uses no patient data and has no institutional validation or measured patient or operational impact.

## ERAS-style description (maximum 750 characters)

I conceived and designed ED Throughput Sandbox, an open-source educational app for exploring emergency-department flow as a systems problem. I designed its discrete-event model: synthetic time-varying arrivals, acuity-priority queues, finite treatment spaces, composite treatment and boarding durations, Monte Carlo uncertainty, paired scenario comparison, and sensitivity analysis. I directed and reviewed the AI-assisted React/TypeScript implementation, deterministic and invariant tests, documentation, and static deployment. The model uses no patient data, has not been calibrated or institutionally validated, and has no measured patient or operational impact; it is not a forecast, staffing tool, or clinical decision aid.

## CV résumé bullets

- Conceived and designed ED Throughput Sandbox, an open-source educational product and discrete-event model for exploring synthetic ED demand, acuity-priority queueing, finite treatment spaces, admission, boarding, and fast-track tradeoffs.
- Directed and reviewed AI-assisted React/TypeScript implementation of seeded Monte Carlo and paired-scenario analysis, with Web Worker execution, deterministic/invariant/browser tests, validated import/export, and source/model documentation; no institutional validation or measured patient impact is claimed.

## LinkedIn / GitHub launch paragraph

I conceived ED Throughput Sandbox and designed both the product and its synthetic discrete-event model for exploring how emergency-department demand, treatment capacity, care duration, admission pressure, and boarding can interact. I directed and reviewed AI-assisted software implementation, testing, documentation, and deployment. It runs entirely in the browser, reports simulation variation across seeded replications, and supports paired scenario comparison and sensitivity analysis. It uses no patient data, has no institutional validation or measured patient impact, and is an educational systems-thinking project—not a hospital forecast or staffing recommendation tool.

## 30-second interview explanation

I conceived ED Throughput Sandbox and designed both the product and its simplified discrete-event model to make ED flow tradeoffs easier to examine. Users vary synthetic arrivals, acuity, treatment-space capacity, admission, boarding, and fast-track assumptions, then compare seeded Monte Carlo runs with uncertainty. I directed and reviewed AI-assisted implementation and testing. It uses no patient data, has no institutional validation or measured patient impact, and is a learning and hypothesis-generation tool—not a forecast or staffing recommendation.

## 90-second interview explanation

I conceived ED Throughput Sandbox to connect my interest in emergency care with systems and operations-research thinking. I designed both the product experience and the simplified discrete-event model. Synthetic patients arrive through a time-varying Poisson process, join strict acuity-priority/FIFO queues, occupy a finite treatment space for a skewed composite duration, and either depart or keep that same space while boarding. The app runs a 24-hour warm-up and then repeats a 24-hour analysis window with deterministic child seeds, reporting replication-level medians and 10th–90th percentile simulation intervals. When demand assumptions match, paired A/B runs use common random numbers to reduce comparison noise, while one-at-a-time sensitivity analysis shows how selected outputs respond to one parameter. I directed and reviewed AI-assisted React/TypeScript implementation, testing, documentation, and deployment, and I can explain the event order, resource invariants, metric cohorts, and limitations. The model uses synthetic assumptions and no patient data. It omits many real ED resources and feedback loops, has not been calibrated or validated to an institution, and has measured no patient or operational impact. It supports learning and hypothesis generation—not forecasting, staffing, or clinical decisions.

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
