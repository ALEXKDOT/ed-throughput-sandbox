# Visualizer v2 quality-assurance record

## Release status

This record covers the separate **Visualizer** workspace and model/schema v2. The first automated implementation-conformance gate passed on 2026-09-14; the overload-visibility and assumption-control revisions passed complete gates on 2026-09-17. The model remains synthetic and unvalidated for real operational use.

## Verified release gates

The following checks were run against the release source:

| Gate                            | Result                                                                |
| ------------------------------- | --------------------------------------------------------------------- |
| Formatting                      | Passed with no changes required after the final source edits          |
| ESLint                          | Passed with zero warnings allowed                                     |
| Strict TypeScript build         | Passed                                                                |
| Vitest                          | 104 tests passed across 11 files                                      |
| Standard Vite production bundle | Passed; 628 client modules transformed                                |
| Sites/Workers production bundle | Passed; emitted `dist/server/index.js` and the complete client bundle |
| Current npm advisory audit      | Passed; zero known vulnerabilities reported                           |

`npm run check` is the reproducible combined gate for formatting, linting, type checking, unit/component tests, and the standard production build. `npm run build:site` verifies the separate private-hosting bundle.

## V2-specific automated evidence

The Visualizer suite checks:

- same-seed determinism, changed-seed variation, patient-keyed random streams, and paired-arrival preservation;
- hourly demand-profile validation, exact scheduled-arrival boundaries, and multiplier-one no-op behavior;
- actual ESI 1–5 priority with FIFO tie-breaking;
- constrained treatment, diagnostic, laboratory, discharge-lounge, hallway, fast-track, and boarding resources;
- off-room boarding release and zero-off-room-capacity treatment-room fallback;
- separation of global care-duration scaling from inpatient-delay scaling;
- warm-up carryover identity, analysis-boundary metrics, and initial-state peaks;
- replay checkpoints, immutable patch folding, exact seeking, continuous clocks between events, queue reconstruction, and trace identity;
- representative-replication selection and shared A/B replication choice;
- shared paired-run settings, demand-pairing warnings, and exhaustive changed-assumption reporting;
- configuration limits for resources, action counts, intervention counts/times, cumulative scale factors, and peak demand;
- schema-v2 import validation, invalid-bundle rejection, CSV formula protection, and exported provenance;
- endpoint time formatting for variable analysis horizons; and
- workspace switching, replay controls, patient/resource inspection, evidence-panel behavior, and stale-result safeguards.

Property-generated tests retained from the Sandbox release continue to check broad capacity and finite-output invariants. V1 tests remain passing, providing regression evidence that the new workspace did not silently redefine the existing Sandbox model.

## Review findings resolved before release

Independent model, correctness, and interface reviews found no release-blocking severity-zero issue. The implementation was revised to resolve their higher-priority findings, including:

- continuous replay wait/length-of-stay clocks and queue-state invalidation;
- zero-capacity boarding completion and treatment-space release behavior;
- exact, paired scheduled-arrival generation rather than hourly quantization;
- analysis-start peak inclusion and warm-up patient trace identity;
- scenario-window/seed/replication compatibility enforcement;
- cumulative intervention and resource-bound validation;
- scenario-scoped A/B selection and inspector synchronization;
- persistent stale-results warnings with unsafe navigation/export disabled;
- per-scenario run timing and split A/B evidence charts;
- complete assumption-change and export-provenance inventories; and
- responsive breakpoints for the dense desktop-first comparison layout.

## 2026-09-17 overload-visibility follow-up

The capacity-visibility revision removes the 24-patient waiting threshold, removes the 300-patient map truncation, and groups the complete boarder census without changing physical resource ownership. Added regression coverage verifies:

- more than 100 simultaneous waiting patients and waits of at least 12 hours in an overloaded synthetic fixture;
- deterministic probability-gated LWBS eligibility and deadline bounds;
- exact agreement between the live waiting KPI and replayed triage/treatment queues;
- boarder census exceeding available off-room boarding spaces while excess boarders continue to hold care spaces;
- all 350 patients in a component fixture rendering on the map;
- unique, row-aligned adaptive patient coordinates inside zone bounds; and
- disjoint resource and patient layout bands.

The complete formatting, lint, strict TypeScript, 96-test, and production-build gate passed after these changes.

## 2026-09-17 baseline-stability and assumption-control follow-up

The baseline-stability revision changes the illustrative default from one CT/two lab processors to two CT/four lab processors and adds advanced controls for ESI mix, ESI treatment medians, admission probability, pathway treatment multipliers, stage medians, and diagnostic-order probability. A live diagnostic-capacity check flags approximate utilization at 85% and 100% thresholds before simulation.

Added regression coverage verifies:

- the revised fixed-seed baseline finishes the representative week with fewer than 50 patients waiting and departures above 90% of analysis arrivals;
- the former two-processor laboratory setup exceeds 100% approximate load and is labeled overloaded;
- pathway diagnostic probabilities change generated orders deterministically;
- pathway treatment-time multipliers change simulated length of stay;
- early schema-v2 setups migrate to the new assumption fields and revised exact legacy CT/lab pair;
- invalid advanced probabilities and multipliers are rejected;
- every new assumption family appears in the A/B change inventory;
- ESI share editing preserves a normalized 100% mix; and
- advanced controls render with the documented default values.

The complete formatting, zero-warning lint, strict TypeScript, 104-test, standard production build, and Sites/Workers production build gate passed after these changes.

## Evidence not claimed

Browser-driven end-to-end, screenshot-diff, and automated full-page accessibility runs were not executed for the new Visualizer during this pass. The repository's existing Playwright workflows primarily document and test the Sandbox-v1 release; they must not be cited as v2 browser evidence.

Before calling the Visualizer a fully audited public release, complete a browser pass covering:

1. baseline run, replay, seek, restart, and peak navigation;
2. A/B split mode at desktop and wide-desktop widths;
3. keyboard traversal, focus visibility, skip links, dialogs, inspectors, and chart alternatives;
4. reduced-motion behavior and screen-reader announcements;
5. validated configuration import and both setup/results exports; and
6. worker failure, stale-result, invalid-input, and reload-recovery states.

The Visualizer is intentionally desktop-first. Small-screen usability is not a current release claim.

## Interpretation boundary

These checks establish that the software behaves consistently with [the model-v2 specification](./MODEL_V2.md) for the tested cases. They do not establish that assumptions resemble a particular emergency department, that numerical outputs predict real performance, or that an intervention would improve care. Institutional use would require governed data, calibration, external validation, workflow review, and prospective evaluation.
