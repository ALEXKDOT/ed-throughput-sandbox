# EdSim feature-adoption record

## Purpose

This document records what was learned from the public [EdSim application](https://www.edsim.app/), which ideas were independently implemented, and which were intentionally excluded. It is the durable reference for subsequent product discussions and prevents “borrow the competitor” from turning into unbounded feature copying.

The review covered the public product experience, configuration surfaces, results views, and shipped browser bundle. No private source, credentials, copyrighted assets, copy, or proprietary configuration data were used. The implementation in this repository is original and follows this project's existing design, evidence, privacy, and accessibility rules.

## 1. What the public implementation revealed

The inspected product is a client-side React/Vite-style single-page application with a configurable event simulation, charting, schema validation, presets, and a minute-oriented timed run loop. Its strongest product idea is not a single chart: it is the continuity between configuration, a visible running system, drill-down inspection, and detailed results.

The public bundle did not expose a source map or full authored source tree. Architectural observations therefore describe shipped behavior and minified client code, not a claim to possess EdSim's underlying source. Its public whitepaper surface was not sufficient to validate every model choice. Those limits are why this project adopts transferable interaction patterns while retaining its own documented semantics and stronger ensemble/comparison evidence.

## 2. Adoption matrix

| Feature or nuance                                        | Decision                  | Project implementation                                                                                                                                                                      | Rationale                                                                                |
| -------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Separate simulation, results, and configuration contexts | **Adapt**                 | Sandbox and Visualizer are separate top-level workspaces; setup, replay, inspectors, and ensemble evidence remain visibly connected inside Visualizer                                       | Preserves context without reproducing EdSim's navigation or dense station-card structure |
| Persistent simulated clock and run controls              | **Adopt**                 | Sticky player with play/pause, restart, previous/next event, four speeds, scrubber, jump-to-peak, and bookmarks                                                                             | Essential for reasoning about a representative week                                      |
| Live KPI strip                                           | **Adapt**                 | Representative values are primary; explicitly labeled 10th–90th ensemble ranges are secondary; cards jump to peak                                                                           | Keeps the animation explanatory without mistaking one run for evidence                   |
| Clickable patients with journey history                  | **Adopt**                 | Map/census selection pins a synthetic patient, separates location from concurrent status, and lists recent journey events                                                                   | Directly supports visual understanding                                                   |
| Resource inspection                                      | **Adapt**                 | Individual room/bed/machine state, ownership, queue, reservation, and occupant; no staff inspector                                                                                          | Appropriate to current no-staffing scope                                                 |
| Schematic operational map                                | **Adapt**                 | Institution-neutral SVG map, individual resources, up to 300 ESI-colored patient dots, locked inpatient placeholder                                                                         | Familiar enough to reason about, without implying a real floorplan                       |
| Quick scenario levers                                    | **Adopt with disclosure** | Demand, main rooms, additive fast track, hallway, care duration, CT, lab, boarding, and inpatient delay; every lever explains its exact modeled effect                                      | Fast experimentation remains auditable                                                   |
| Baseline/intervention comparison                         | **Strengthen**            | Same seed/window, patient-keyed random streams, time-synchronized A/B replay, exhaustive changed-assumption list, within-replication deltas, demand-pairing warning                         | More defensible than visually comparing unrelated days                                   |
| Overflow and capacity visibility                         | **Adopt**                 | Waiting overflow is an explicit location and metric; capacity consists of visible resource units                                                                                            | Makes bottlenecks spatial and inspectable                                                |
| Rich results explorer                                    | **Adopt**                 | Eight ensemble metrics, paired deltas, hourly uncertainty band, selected representative provenance, CSV comparison report                                                                   | Connects “what happened” to “how variable was it?”                                       |
| Guided setup                                             | **Adapt**                 | Adjust → Run → Replay & inspect guidance plus baseline-to-intervention copying                                                                                                              | Enough orientation without a mandatory wizard                                            |
| Reproducible configuration                               | **Strengthen**            | Separate schema-v2 local persistence, validated paired import/export, seed, algorithm/trace versions, scenario digest, assumptions, and representative-selection metadata in result exports | Keeps downloaded evidence traceable to its modeled setup                                 |
| General layout/pathway authoring                         | **Defer**                 | Versioned location/resource contracts and generic map geometry make it possible later                                                                                                       | Drag/drop authoring requires validation, migration, and stronger pathway tests           |
| Mid-run intervention UI                                  | **Defer**                 | Engine contract supports scheduled changes; current UX changes assumptions and reruns from the same seed                                                                                    | Avoids pretending a visual-only branch is a causal continuation                          |

## 3. Deliberately excluded EdSim ideas

The following are out of scope or conflict with this project's goal:

- UK/NHS terminology, four-hour target framing, NHS escalation workflow, or other jurisdiction-specific operational conventions;
- staffing, rota, skill-mix, wage, and cost modeling in this iteration;
- live EPR/census integrations, institution accounts, or patient-data workflows;
- RAG verdicts, “good/bad” intervention coloring, or operational recommendations;
- EdSim presets, constants, scenario data, wording, artwork, branding, or code;
- minute-by-minute main-thread simulation as the analytical architecture; and
- EdSim's observed priority categories in place of actual five-level ESI.

These exclusions preserve the app's institution-neutral, synthetic, educational purpose and avoid false confidence.

## 4. Where the adopted features live

- Workspace shell and worker lifecycle: `src/visualizer/VisualizerApp.tsx`
- ESI/resource/location/trace contracts: `src/simulation/v2/types.ts`
- Generic layout and default assumptions: `src/simulation/v2/defaults.ts`
- Event-driven model: `src/simulation/v2/engine.ts`
- Keyed paired randomness: `src/simulation/v2/random.ts`
- Representative selection: `src/simulation/v2/representative.ts`
- Exact checkpoint replay: `src/simulation/v2/replay.ts`
- Separate worker protocol: `src/workers/visualizer.worker.ts`
- Map, levers, KPIs, census/inspectors, and evidence: `src/visualizer/`
- Normative semantics and limits: `docs/MODEL_V2.md`

## 5. Recommended next decisions

Future prompts can use these stable feature IDs:

- **VIZ-01:** saved bookmarks with user annotations;
- **VIZ-02:** scheduled open/close/capacity intervention editor;
- **VIZ-03:** active observation pathway;
- **VIZ-04:** richer complaint/pathway editor;
- **VIZ-05:** generic drag/drop layout authoring;
- **VIZ-06:** exportable printable comparison narrative;
- **VIZ-07:** institution configuration package and validation workflow; and
- **VIZ-08:** v2-backed “basic” editor, after migration semantics are explicitly accepted.
- **VIZ-09:** outcome filtering and stratification by ESI, arrival mode, disposition, pathway, and time;
- **VIZ-10:** vertical/waiting-room care and overflow-triage semantics; and
- **VIZ-11:** minimum/design/maximum resource-capacity semantics.

The next high-value work should be chosen from VIZ-01 through VIZ-04. Layout authoring and institution packages should wait until the core event semantics have more fixture coverage.

VIZ-08 is a deliberate deferral from the longer-term request for actual ESI 1–5 everywhere. Sandbox v1 retains its historical three operational tiers so existing results and shared scenarios are not silently reinterpreted; the new Visualizer uses actual ESI 1–5 throughout.
