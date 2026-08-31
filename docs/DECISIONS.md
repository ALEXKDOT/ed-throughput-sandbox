# Material decisions

This log records consequential product, model, and engineering choices for model/schema version 1. It reconciles the operations-research, design, engineering, and independent-QA workstreams.

## D-001 — Educational hypothesis sandbox, not forecasting product

**Decision.** Position the application as a synthetic systems-learning tool. Exclude patient-level input, institution calibration, operational recommendations, causal claims, and clinical decision support.

**Alternatives considered.** A configurable hospital forecaster or staffing calculator.

**Reason.** No governed institutional data, fitted input model, empirical calibration, or prospective validation exists. A narrower claim makes the artifact useful without overstating evidence.

## D-002 — Input–throughput–output as the primary information architecture

**Decision.** Use the Asplin conceptual framework to organize assumptions and orientation, while labeling every numerical default as project-specific and synthetic.

**Alternatives considered.** Organizing controls by software module or putting every parameter in one generic form.

**Reason.** The framework communicates that crowding is a system phenomenon and gives non-specialists a durable mental model. The cited paper supports the conceptual structure, not this implementation's parameter values.

## D-003 — Event-driven simulation with a priority queue

**Decision.** Schedule arrivals, treatment completions, and boarding completions in a binary-heap event queue. Batch equal timestamps in the fixed order boarding completion, treatment completion, arrival, then one exhaustive resource dispatch.

**Alternatives considered.** Minute-by-minute state updates or a process-interaction simulation dependency.

**Reason.** Event scheduling is more precise and efficient for this model, makes simultaneous-event semantics testable, and avoids a large simulation framework dependency.

## D-004 — Analysis-window event cohorts

**Decision.** Warm up for 24 hours, then observe 24 hours. Count arrivals and departures by their event time; calculate waits for treatment starts in the window and lengths of stay for departures in the window. Snapshot remaining patients at the left limit of analysis end.

**Alternatives considered.** Arrival-cohort metrics, which are right-censored at the horizon, or draining the system beyond the displayed day.

**Reason.** Event cohorts avoid silently dropping long waits and stays while keeping reported activity tied to the displayed window. The definition is explicit because no cohort rule is universally correct.

## D-005 — Exact time-weighted 15-minute status bins

**Decision.** Integrate state over every event-to-event interval and allocate its area to 15-minute bins. Display hourly arrival/departure counts separately.

**Alternatives considered.** Point sampling every 15 minutes.

**Reason.** Time weighting avoids missing short state changes and correctly supports average occupancy, boarder-hours, and high-occupancy time. Hourly flow matches the product requirement and remains readable on mobile.

## D-006 — Conditional truncated lognormal durations

**Decision.** Parameterize treatment and boarding by a user-readable median and log-scale variability. Sample the conditional distribution between explicit bounds by inverse CDF, with a final numerical bound guard. A boarding median of zero is a deterministic special case.

**Alternatives considered.** Gamma distributions, unbounded lognormal draws, rejection sampling, or clipping/winsorization.

**Reason.** The lognormal captures positive skew, the median is understandable, inverse-CDF truncation uses one uniform draw for CRN alignment, and hard bounds prevent pathological runs. Parameters are synthetic choices, not literature estimates.

## D-007 — Fixed, versioned random streams and common random numbers

**Decision.** Freeze a 32-bit seed mixer/PRNG and key arrival streams by replication/hour and patient streams by replication/ordinal. Scenario B uses Scenario A's master seed and replication indices. Paired deltas are calculated within replication.

**Alternatives considered.** `Math.random`, one event-order-dependent stream, or independent A/B seeds.

**Reason.** Fixed streams make scenarios reproducible, protect corresponding random variates from event-order divergence, and reduce comparison noise when demand matches. Exact test vectors guard accidental algorithm drift.

## D-008 — Fast track reallocates total spaces

**Decision.** Fast-track spaces are never additive. Only low-acuity patients may use them; low acuity routes to idle fast track before spare main capacity, while high/moderate retain strict main-space priority.

**Alternatives considered.** Adding fast-track capacity or reserving low-acuity patients exclusively for fast track.

**Reason.** Reallocation prevents a misleading capacity increase, and flexible low-acuity use avoids stranding compatible main resources.

## D-009 — Canonical admission anchor with tier caps

**Decision.** Scale the fixed synthetic anchor `(0.45, 0.18, 0.03)` by a common factor and cap tiers at `(0.90, 0.60, 0.20)`. Solve the requested weighted rate by deterministic bisection.

**Alternatives considered.** Additive changes, unconstrained odds scaling, or scaling the current edited rates.

**Reason.** The method is monotone, path-independent, preserves relative tier differences before caps, and recovers correctly after a zero target. Advanced tier edits remain available.

## D-010 — Worker cancellation by termination

**Decision.** Run Monte Carlo and sensitivity work in a module Web Worker. Cancel by terminating the worker and invalidating its run ID; publish only complete result messages.

**Alternatives considered.** A cancellation message checked between replications.

**Reason.** A CPU-bound worker cannot reliably receive a message until it yields. Termination provides immediate, race-safe cancellation and prevents stale partial results from replacing the last complete run.

## D-011 — Manual runtime schema validation

**Decision.** Reconstruct imported/URL/local state field-by-field with finite-number, range, enum, size, version, name, and allocation checks. Normalize a positive acuity vector and report the normalization on file import.

**Alternatives considered.** Blind object merge or a runtime validation dependency.

**Reason.** Fieldwise reconstruction blocks prototype-pollution-style merges and keeps the runtime dependency surface small. The schema is compact enough to audit directly.

## D-012 — Recharts, loaded only for results

**Decision.** Use Recharts for responsive SVG charts, code-split from the initial bundle, and pair every chart with a text description or readable data table.

**Alternatives considered.** Hand-built SVG, canvas, or a commercial charting package.

**Reason.** Recharts offers maintainable responsive primitives without proprietary licensing. Lazy loading protects initial load; textual alternatives avoid making hover tooltips the only access path.

## D-013 — Static GitHub Pages architecture

**Decision.** Use React, strict TypeScript, Vite, custom CSS, Web Workers, Vitest, Playwright, and GitHub Actions with no backend.

**Alternatives considered.** A server application, user accounts, database persistence, or hosted analytics.

**Reason.** Every required capability fits in the browser. Static hosting minimizes privacy, security, cost, and maintenance risk and produces a clone-and-run portfolio repository.

## D-014 — Restrained clinical-operations visual language

**Decision.** Use ink/off-white surfaces, blue input, teal throughput, amber output, labeled shapes, modest type scale, borders, and whitespace. Use no gradient, glass, stock medical imagery, or color-only meaning.

**Alternatives considered.** Dense enterprise dashboards or marketing-style hero visuals.

**Reason.** The intended audience needs seriousness, fast orientation, legible controls, and interview-ready polish across desktop and mobile.

## D-015 — Step-constrained controls with validation at both execution boundaries

**Decision.** Snap typed numeric values to each control's declared step grid, require integer capacities, allocations, replication counts, and seeds, validate a reconstructed scenario before cache lookup or worker dispatch, and validate again inside the worker.

**Alternatives considered.** Relying on HTML `step` attributes, silently coercing inside the random generator, or validating imports only.

**Reason.** Browser number inputs do not enforce `step` for typed values. Fractional capacity can otherwise violate the resource invariant, while fractional seeds or replication counts create runtime-specific coercion. Defense in depth keeps the cache key, displayed assumptions, and executed snapshot aligned.

## D-016 — Immutable provenance for comparisons and sensitivity

**Decision.** Capture run targets at launch; mark a comparison stale when either scenario changes; key sensitivity output to the complete source scenario; and aggregate A-relative-to-B percentage intervals directly from raw paired replications so Swap can reverse direction exactly.

**Alternatives considered.** Deriving status from the currently selected tab, checking only the sensitivity parameter/outcome, or applying a nonlinear denominator conversion to an already-aggregated interval.

**Reason.** Users may edit or navigate while a worker runs. Explicit provenance prevents old output from appearing current or being attributed to the wrong scenario, and direct reverse aggregation preserves the documented quantile definition.
