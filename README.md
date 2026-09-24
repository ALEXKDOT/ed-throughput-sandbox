# ED Throughput Sandbox

A browser-based discrete-event simulation with two workspaces: Sandbox for aggregate scenario analysis and Visualizer for patient and resource replay.

**[Open the live demo](https://alexkdot.github.io/ed-throughput-sandbox/)** · [Model specification](./docs/MODEL.md) · [Evidence and limitations](./docs/QA.md)

- Configure synthetic arrivals, acuity, treatment spaces, care duration, admission, boarding, and low-acuity fast-track assumptions.
- Run seeded Monte Carlo replications and inspect medians with 10th–90th percentile simulation intervals.
- Compare paired A/B scenarios, run one-at-a-time sensitivity analysis, and share or export assumptions and results.
- Replay a representative synthetic week with actual ESI 1–5, individual resources, diagnostic queues, uncapped waiting and boarding census, exact scrubbing, patient event histories, resource inspection, synchronized A/B maps, and editable stage-level clinical-flow assumptions.

> **Synthetic-model disclaimer:** This educational systems-modeling project uses illustrative synthetic assumptions and no patient data. It has not been calibrated or validated to any institution, has measured no patient or operational impact, and must not be used for clinical, staffing, regulatory, or operational decisions.

![Current ED Throughput Sandbox desktop interface showing synthetic assumptions and simulation results](./public/screenshots/app-desktop.png)

ED Throughput Sandbox is a static, client-side application: the model runs in a Web Worker, and no backend, account, database, telemetry, or runtime API key is involved.

## Product, model, and implementation ownership

- **Product conception and design:** Alexander Krawec defined the use case, interaction model, scope, and evidence boundaries.
- **Simulation-model design:** Alexander translated the input–throughput–output framework into the documented event logic, synthetic assumptions, metrics, and comparison approach.
- **AI-assisted software implementation:** The React/TypeScript implementation, testing, documentation, and release work used AI coding assistance under Alexander's direction and review.
- **Evidence status:** Software verification establishes implementation conformance only. The project has no institutional calibration or validation and no measured patient or operational impact.

## Two versioned models

The public **Sandbox** continues to use the documented model/schema v1. The newly implemented, separately verified **Visualizer** uses model/schema v2 so richer patient movement does not silently redefine historical v1 results.

### Sandbox v1 at a glance

| Domain         | Synthetic inputs                                                                           | Model role                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| **Input**      | Mean arrivals, hourly profile, three-tier acuity mix                                       | Creates a piecewise-constant nonhomogeneous Poisson arrival stream and strict-priority/FIFO queue |
| **Throughput** | Total spaces, tier treatment medians, duration variability, optional fast-track allocation | Determines eligible treatment resources and truncated-lognormal service durations                 |
| **Output**     | Tier admission probabilities, median boarding duration                                     | Determines whether a patient departs after treatment or retains the same ED space while boarding  |

Simultaneous events are processed deterministically: boarding completions, treatment completions, arrivals, then one exhaustive dispatch. The simulator never preempts treatment, models clinical deterioration, or separates clinicians, diagnostics, inpatient beds, transport, environmental services, or specialty placement. Read [docs/MODEL.md](./docs/MODEL.md) for the normative contract.

Visualizer v2 adds five-level ESI, walk-in/ambulance arrivals, individual treatment and diagnostic resources, editable ESI/pathway/stage assumptions, a pre-run diagnostic-capacity warning, physical location independent from concurrent statuses, room reservation during imaging, an uncapped boarding census with finite off-room spaces and treatment-space fallback, synthetic rare exits, a seven-day trace, and representative-replication selection. It remains an illustrative synthetic model with no staffing or institution calibration. Read [docs/MODEL_V2.md](./docs/MODEL_V2.md) for its separate normative contract.

## Run locally

Requirements: Node.js 24.15 or newer within the Node 24 release line, plus npm.

```bash
npm ci
npm run dev
```

The development server prints the local URL. All simulation work occurs in the browser.

## Development commands

| Command                 | Purpose                                                           |
| ----------------------- | ----------------------------------------------------------------- |
| `npm run assets:social` | Regenerate the 1,280 × 640 social-preview PNG from its SVG source |
| `npm run dev`           | Start the Vite development server                                 |
| `npm run build`         | Type-check and create the production bundle                       |
| `npm run build:site`    | Create the private Sites/Workers release bundle                   |
| `npm run preview`       | Preview the production bundle locally                             |
| `npm run format:check`  | Verify formatting                                                 |
| `npm run lint`          | Run ESLint with zero warnings allowed                             |
| `npm run typecheck`     | Run strict TypeScript checks                                      |
| `npm test`              | Run deterministic, invariant, property, aggregation, and UI tests |
| `npm run test:coverage` | Generate unit-test coverage                                       |
| `npm run test:e2e`      | Run desktop, mobile, tablet, and wide Playwright workflows        |
| `npm run check`         | Run the full non-browser quality gate                             |

Install the pinned browser runtime once before local end-to-end testing:

```bash
npm run test:e2e:install
```

## Testing and validation

The committed suite covers exact PRNG and duration-transform vectors, zero-arrival and known-event fixtures, resource limits, fast-track eligibility, strict priority/FIFO behavior, uncapped queues and room-blocking/off-room boarding, warm-up boundaries, same-seed reproducibility, paired comparisons, intervention boundaries, replay reconstruction, hostile imports, portability, CSV safety/provenance, property-generated capacities, and workspace UI behavior.

Passing software tests establishes implementation conformance—not empirical validity. Neither model has been calibrated or validated against a real ED. [docs/VALIDATION.md](./docs/VALIDATION.md) and [docs/QA.md](./docs/QA.md) record the audited Sandbox-v1 release; [docs/QA_V2.md](./docs/QA_V2.md) records the newer Visualizer-v2 checks and the browser/a11y evidence that remains outstanding.

[![CI](https://github.com/ALEXKDOT/ed-throughput-sandbox/actions/workflows/ci.yml/badge.svg)](https://github.com/ALEXKDOT/ed-throughput-sandbox/actions/workflows/ci.yml)
[![Deploy GitHub Pages](https://github.com/ALEXKDOT/ed-throughput-sandbox/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/ALEXKDOT/ed-throughput-sandbox/actions/workflows/deploy-pages.yml)

## Deployment

The public Sandbox remains designed for GitHub Pages. The deployment workflow in [`.github/workflows/deploy-pages.yml`](./.github/workflows/deploy-pages.yml) builds the project-site base path and publishes `dist/` only after the full code-quality and responsive Chromium gates pass on `main`.

The same source also has a separate private Sites/Workers build for reviewing the Visualizer before it is promoted into the public release. The two targets share the versioned source and test suite but use separate production bundles, so the existing GitHub Pages workflow is unchanged.

To deploy a fork:

1. Update the repository, site, and citation metadata for the fork owner.
2. In the GitHub repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push to `main` or manually run the **Deploy GitHub Pages** workflow.
4. Verify the root URL, a URL containing shared scenario state, and the mobile layout.

No runtime API keys or environment secrets are required.

## Documentation

- [Model specification](./docs/MODEL.md): event logic, distributions, metrics, CRN, defaults, and limitations.
- [Visualizer model-v2 specification](./docs/MODEL_V2.md): individual resources, ESI, pathways, diagnostics, replay, representative selection, and limits.
- [EdSim feature-adoption record](./docs/EDSIM_ADOPTION.md): what was adopted, adapted, excluded, or deferred and why.
- [Sources](./docs/SOURCES.md): verified citations and claim-by-claim support boundaries.
- [Sandbox-v1 design system](./docs/DESIGN.md): original information architecture, responsive rules, accessibility, and visual language.
- [Decision log](./docs/DECISIONS.md): consequential product and engineering choices.
- [Sandbox-v1 validation plan](./docs/VALIDATION.md): deterministic fixtures, invariants, and release gates.
- [Sandbox-v1 QA record](./docs/QA.md): audited release commands, environments, findings, and fixes.
- [Visualizer-v2 QA record](./docs/QA_V2.md): current automated evidence and explicit remaining gates.
- [Sandbox-v1 portfolio language](./docs/PORTFOLIO.md): accurate descriptions, résumé bullets, and interview answers for the original release.
- [Sandbox-v1 owner guide](./docs/OWNER_GUIDE.md): the original model concepts and extension guidance.

## Limitations

- Defaults and presets are illustrative synthetic assumptions, not hospital benchmarks.
- This is not a validated forecasting model, patient-care tool, staffing recommender, or crowding score.
- Strict priority can produce prolonged low-acuity waits under severe overload.
- Treatment time combines many operational steps that are not separately represented.
- Boarding is an aggregate output constraint; the inpatient bed system is not modeled.
- Monte Carlo intervals describe simulation variation under chosen assumptions, not predictive uncertainty for a real ED.
- One-at-a-time sensitivity analysis does not identify multi-parameter interactions.
- Visualizer-v2 results are currently system-level rather than stratified by ESI, mode, pathway, disposition, or time slice.
- Visualizer-v2 does not yet model staffing, observation routing, vertical/waiting-room treatment, overflow triage, inpatient-unit matching, or resource minimum/design/maximum semantics.
- Sandbox v1 deliberately retains its historical three operational tiers; migrating the basic editor to actual ESI 1–5 remains a separate schema decision.

The conceptual model and simulation approach draw on peer-reviewed literature including Asplin et al. (2003), Hoot et al. (2008), and Bair et al. (2010). Sources support the framework and method; they do **not** validate the numerical defaults. Full citations and DOI/PMID links are in [docs/SOURCES.md](./docs/SOURCES.md).

## Privacy and security

The app uses no patient data, cookies, analytics, advertising, accounts, backend, or database. Imported JSON is size-limited and reconstructed field-by-field; unknown content is never merged into application objects or rendered as HTML. Scenario names are formula-escaped in CSV exports. See [SECURITY.md](./SECURITY.md) for reporting guidance.

## Citation

Published by Alexander Krawec at [ALEXKDOT/ed-throughput-sandbox](https://github.com/ALEXKDOT/ed-throughput-sandbox). Machine-readable citation metadata is available in [CITATION.cff](./CITATION.cff).

## License and disclaimer

MIT licensed; see [LICENSE](./LICENSE).

> This application is an educational systems-modeling project. It uses synthetic inputs and simplified assumptions, has not been calibrated or validated to any institution, and has measured no patient or operational impact. It should not be used for staffing, clinical, regulatory, or operational decisions.
