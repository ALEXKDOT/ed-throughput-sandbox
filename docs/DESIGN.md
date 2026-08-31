# ED Throughput Sandbox design specification

## 1. Product experience

ED Throughput Sandbox is an educational operations model, not a clinical dashboard. The interface should help a user form a question, change a small number of understandable assumptions, run a reproducible experiment, and interpret uncertainty without implying a real-world recommendation.

The experience should feel calm, exact, and trustworthy enough for a clinical-operations review. It should not look like an electronic health record, a command center, or a generic analytics template.

### Experience principles

1. **Teach the system before showing the numbers.** Input, Throughput, and Output remain visible as the organizing model from assumptions through interpretation.
2. **Put the experiment before the dashboard.** Controls, run state, seed, replication count, and scenario provenance are never hidden behind a result.
3. **Preserve context.** Editing a scenario does not erase its last completed results. It marks them as out of date until the user runs again.
4. **Treat uncertainty as part of the answer.** A point estimate and its across-replication interval are presented together, with the aggregation method close at hand.
5. **Make comparisons neutral.** “Higher,” “lower,” and “similar” describe changes; green/red “better/worse” judgments do not.
6. **Use progressive disclosure.** The first run needs only a handful of controls. Exact tier probabilities, duration medians, variability, replications, and seed live in Advanced settings.
7. **Be explicit about scope.** “Synthetic model,” “No patient data,” and “Educational use” are persistent context, not a one-time modal.
8. **Keep every primary action reversible.** Duplicate, rename, swap, reset, import, and edit all preserve a clear escape path. Reset and replacement imports require confirmation when they would overwrite unsaved scenario work.

## 2. Information architecture

### Global structure

The public application is one continuous **Sandbox** workspace for scenario assumptions, run controls, results, and A/B comparison. Two focused tools open from the header as modal dialogs so the experiment remains in context:

- **Sensitivity** — one-variable sensitivity analysis. It inherits the active scenario and discloses its lower replication count.
- **Methodology** — model scope, event logic, assumptions, sources, metric definitions, limitations, and data/privacy statement.

Exported/printable **Report** is a presentation of the current completed results, not a fourth workspace. It opens from the results actions.

On narrow screens, Sandbox remains visible behind the dialogs. Sensitivity and Methodology remain labeled header actions; the optional Source link is hidden first. Scenario actions remain in the scenario bar rather than moving into the project navigation.

### Sandbox page hierarchy

1. **App header**
   - Product mark and “ED Throughput Sandbox.”
   - Brand/home link plus Sensitivity and Methodology dialog triggers.
   - Optional Source link when a repository URL is configured.
   - Persistent trust labels: “Synthetic model,” “No patient data,” “Educational use.”
2. **Compact orientation hero**
   - Subtitle and one supporting sentence.
   - The Input → Throughput → Output relationship is introduced in the results-ready state and repeated compactly with completed results.
   - Run and Compare remain in the scenario workspace from first load onward.
3. **Scenario action bar**
   - Active scenario tabs: A or B, plus a separate Compare toggle.
   - Scenario name and state: Not run, Current, Changes not run, or Running.
   - Preset selector, scenario overflow actions, replication summary, and Run/Cancel.
4. **Experiment workspace**
   - Assumptions editor.
   - Results or comparison view.
5. **Method note and disclaimer**
   - Short aggregation note and link to Methodology.
   - Full educational-use disclaimer in the footer.

### Assumption hierarchy

The default editor shows the minimum useful controls in three domain groups.

| Domain     | Main controls                                                                        | Advanced controls                                                 |
| ---------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Input      | Mean arrivals per hour; arrival pattern; acuity mix summary/editor                   | Custom six-block arrival profile; exact acuity percentages        |
| Throughput | Total treatment spaces; treatment-time scale; fast-track on/off and allocated spaces | Exact duration medians; variability preset; fast-track duration   |
| Output     | Overall admission rate; median boarding duration                                     | Tier admission probabilities and the weighted overall calculation |
| Run setup  | Replication summary only                                                             | Replications (20–200); seed; New seed                             |

Use user-facing language first and model terminology second. For example, use “Average arrivals” as the label and “Mean arrival rate used by the Poisson process” in help text.

Each domain heading has a one-sentence explanation:

- **Input — Who arrives, and when.**
- **Throughput — How treatment spaces and care duration shape flow.**
- **Output — How admission and boarding keep spaces occupied.**

Advanced controls open together in an “Advanced assumptions” disclosure at the bottom of the assumptions editor, not in a detached page. At 900 px and below, only the selected main domain is visible while this shared disclosure remains directly available.

### Results hierarchy

Results are ordered from orientation to detail:

1. Persistent stale/error/cancellation notice when applicable.
2. Run provenance, uncertainty definition, export, and print actions.
3. In Compare mode, changed assumptions, aligned A/B/paired-delta results, and a model-bounded interpretation appear before either scenario’s detailed charts.
4. A compact Input → Throughput → Output map.
5. Eight headline summary metrics in a 4 × 2 desktop or 2-column compact grid: median wait, 90th-percentile wait, boarder-hours, departures, average occupied spaces, time at or above 90% occupancy, peak queue, and patients remaining in the system.
6. An open-by-default, collapsible Additional measures grid completes the 15 required summaries: arrivals, end-state waiting and occupancy, three length-of-stay measures, and peak occupancy.
7. System status over time and the arrival/departure pattern, each with a semantic data disclosure.
8. Wait by acuity and the closing scope reminder.

## 3. Core user journeys

### First run

1. The user lands on the **Balanced baseline** with an “Illustrative synthetic scenario” label.
2. The hero explains the experiment in two short lines; the ready-state Input → Throughput → Output map shows how the controls connect.
3. The assumption groups are visible; Advanced settings are collapsed.
4. The results area contains a compact ready state rather than fabricated or precomputed values.
5. “Run simulation” snapshots the visible assumptions and moves the scenario to Running.
6. A determinate progress bar reports completed replications and provides Cancel.
7. Completed results retain the scenario name, preset provenance, seed, replication count, and interval definition.

Implemented initial empty-state copy:

> **See how the system responds**  
> Run repeated seeded simulations to estimate waits, occupancy, flow, and boarding—with 10th–90th percentile uncertainty intervals across replications.

### Change and rerun

Changing any result-affecting assumption sets the scenario state to **Changes not run**. Keep the previous result cards and charts rendered, but precede them with a persistent notice:

> **Assumptions changed**  
> Results below are from the previous run. Run the updated scenario to refresh them.

The notice includes “Run updated assumptions.” It is not a transient toast. Result values receive a small “Previous run” label; they are not blurred or disabled.

### Create and compare an intervention

1. Scenario B is created with the workspace and initially named **Intervention**.
2. “Duplicate A → B” is the recommended controlled-comparison shortcut: it copies A’s assumptions, seed, and replication count into B, switches focus to B, and enters Compare mode.
3. Changed assumptions appear directly above outcome deltas once both scenarios have completed results.
4. “Run both scenarios” uses the same master seed and one paired-run progress indicator.
5. Compare shows changed assumptions before outcome deltas, so the reader sees the experiment before its result.
6. The interpretation panel describes only outcomes within the synthetic model.

Comparison guidance copy:

> **Create an intervention scenario**  
> Copy Baseline into Scenario B, change one or more assumptions, then run both with the same seed for a clearer comparison.

If demand assumptions differ, show this persistent warning directly above the comparison:

> **Demand also differs between scenarios.** Result changes reflect both demand and operational assumptions, so they should not be read as the isolated effect of one intervention.

### Save, share, and export

- **Share link** encodes both scenario configurations, their names, and schema version. It does not promise to preserve computed results.
- **Export scenarios (.json)** exports inputs plus model/schema version and may include completed result provenance.
- **Export results (.csv)** appears only when current completed results exist.
- **Print report** presents the completed result cards, uncertainty definition, charts, comparison warnings, and scope statement without the interactive controls.
- Success messages state what was copied or downloaded; failure messages preserve all scenario state.

## 4. Responsive layouts

The implementation should be fluid down to 320 CSS pixels and explicitly inspected at 390 × 844, 768 × 1024, 1440 × 900, and a wide desktop viewport. Breakpoints below describe behavior, not device identity.

| Viewport                     | Shell and navigation                                                                                                                                                                                       | Assumptions and results                                                                                                                                                                                | Primary action                                                                                                                                                                   | Charts and comparison                                                                                                                                                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **390 × 844**                | 12–16 px content gutters. The compact product mark and labeled Sensitivity/Methodology actions share the header; the full brand text and optional Source link hide. Trust labels wrap below the hero copy. | One column. A/B scenario tabs remain visible. A three-button Input/Throughput/Output switcher shows one domain at a time; Advanced settings remain an in-place disclosure. Results follow assumptions. | A bottom dock contains the 48 px-high Run/Cancel action and, when available, View results. Add bottom content padding and `env(safe-area-inset-bottom)`; hide the dock in print. | Charts use full content width; status plots are 250 px high and the flow plot is compact. The semantic comparison table is visually restyled as metric cards, with changed assumptions above it. No horizontal page scrolling. |
| **768 × 1024**               | 20–24 px gutters. Full title and project actions fit in the header; trust labels sit beside the compact hero when space permits.                                                                           | Stacked workspace. The domain switcher shows Input/Throughput/Output one at a time, results use the full width below, and headline metrics use two columns. Avoid a narrow permanent rail.             | The scenario bar returns to document flow and the bottom action dock supplies Run/Cancel.                                                                                        | System status and flow charts stack at full width. Comparison retains its semantic table and can scroll locally if an unusually long value cannot wrap.                                                                        |
| **1440 × 900**               | Workspace max width 1480 px with 32 px gutters; the scenario bar is capped at 1600 px. The 64 px header and compact hero keep the workspace near the first viewport.                                       | Two-column workspace: 368 px assumptions rail, 24 px gap, flexible results column. All three main domain cards are visible; Advanced settings remain collapsed by default.                             | Scenario bar is sticky at the top while the page scrolls. Run is visually strongest; share/export remain secondary.                                                              | Summary measures use four columns. System status spans the results width, followed by the flow chart and wait-by-acuity detail. Comparison uses aligned A/B/delta columns.                                                     |
| **Wide desktop (≥ 1680 px)** | Center the workspace at a max width of 1480 px and scenario bar at 1600 px; do not stretch prose or plots edge to edge.                                                                                    | Retain the 368 px assumptions rail and 24 px gap rather than introducing a wider control rail or a second results sidebar.                                                                             | Same as 1440; actions remain attached to scenario context.                                                                                                                       | Keep four metric columns and let the capped container preserve readable plot proportions. Use additional width as whitespace, not elongated lines.                                                                             |

### Mobile-specific details

- The bottom action dock never covers field errors, chart controls, or the footer. Its scenario label truncates with an accessible full name.
- The scenario name remains directly editable. Duplicate, Swap, Compare, and More form a compact action row; Share, JSON export/import, and Reset live in More. Run and mode switching never move into the overflow menu.
- Sliders retain a directly editable numeric field. The field occupies enough width for the longest valid value and unit.
- The custom arrival profile is editable as six four-hour numeric blocks. Its mini-chart is a preview, not the only editing mechanism.
- “View results” after a completed run scrolls to and focuses the Results heading only when the user invokes it; completion itself does not move focus.
- Long comparison values wrap below their labels. Percentage deltas are omitted when the baseline denominator makes them undefined.

## 5. Visual system

### Tone

Use crisp alignment, restrained white surfaces, deliberate whitespace, and limited decoration. Avoid glass effects, gradients, large shadows, photos, hospital-brand mimicry, and ornamental medical icons. The product mark may be a small original line-and-block flow symbol; it should suggest movement through a constrained system, not a cross, heart, or ambulance.

### Color tokens

These tokens are a starting palette. Contrast values must be rechecked in the rendered product, including disabled and focus states.

| Token               | Value     | Use                                            |
| ------------------- | --------- | ---------------------------------------------- |
| `--canvas`          | `#F4F7F9` | Page background                                |
| `--surface`         | `#FFFFFF` | Cards, controls, charts                        |
| `--surface-subtle`  | `#F8FAFB` | Secondary rows, plot background                |
| `--ink`             | `#132B3A` | Primary text                                   |
| `--ink-muted`       | `#526874` | Secondary text                                 |
| `--primary`         | `#075E73` | Primary button and Scenario A line             |
| `--input`           | `#175E8C` | Input marker and chart series                  |
| `--input-tint`      | `#EEF5F9` | Input group tint                               |
| `--throughput`      | `#006B64` | Throughput marker and chart series             |
| `--throughput-tint` | `#EEF8F6` | Throughput group tint                          |
| `--output`          | `#855700` | Output marker and chart series                 |
| `--output-tint`     | `#FBF6E9` | Output group tint                              |
| `--stress`          | `#A53B32` | Severe stress and destructive/error state only |
| `--border`          | `#7A8F9A` | Control boundaries and strong card borders     |
| `--border-light`    | `#D4DFE4` | Internal rules and noninteractive card borders |
| `--focus`           | `#0B6BCB` | 2–3 px focus ring with 2 px offset             |

Domain color is always paired with the words Input, Throughput, or Output and a stable geometric marker: Input/circle, Throughput/rounded square, Output/diamond. Do not use the domain colors as decorative card backgrounds; use a 3 px edge, small marker, or icon with the subtle tint.

Muted red is reserved for validation errors, failed runs, and genuinely severe modeled stress. Ordinary “higher” or “lower” scenario deltas remain navy/teal with explicit direction text.

### Typography

Prefer a bundled Inter variable font only if it does not add a network request; otherwise use:

```css
font-family:
  Inter,
  ui-sans-serif,
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  'Segoe UI',
  sans-serif;
```

- Hero title: 32–36 px desktop, 28–30 px mobile, 700 weight, tight but not compressed tracking.
- Page/section heading: 24/20 px, 650–700 weight.
- Card/control heading: 16 px, 650 weight.
- Body and form values: 16 px with 1.45–1.6 line height.
- Supporting text: 12–14 px; use 13–14 px for explanatory copy and notices. Scenario state and other decision-critical labels should not fall below 11 px.
- Chart axes/data annotations: 12 px minimum, 13 px preferred.
- Numeric results use tabular figures. Avoid monospaced body copy.
- Explanatory prose is capped around 68 characters per line.

### Spacing, shape, and elevation

- Use a 4 px base and an 8 px primary spacing rhythm.
- Page gutters: 16 / 24 / 32 px by viewport.
- Section spacing: 24 px mobile, 32 px desktop.
- Card padding: 16 px compact, 20–24 px standard.
- Form row gap: 12–16 px; touch targets: 44 px preferred, never below 24 × 24 CSS px.
- Border radius: 8 px cards, 6 px inputs/buttons, full radius only for small status chips.
- Borders do most grouping. Use a single subtle shadow only for sticky/elevated action surfaces, such as `0 4px 16px rgb(19 43 58 / 8%)`.
- Transitions are 120–180 ms and limited to color, opacity, and small disclosure movement. Honor `prefers-reduced-motion`.

### Iconography

Use one consistent 1.5–2 px stroke icon set. Icons supplement labels and are not used as unexplained primary actions. Download, share, more, information, warning, and close icons need accessible names or hidden SVG markup when adjacent text already supplies the name.

## 6. Component patterns

### Scenario tabs and state

Scenario A and B form a two-item tab list. Compare is a separate pressed/unpressed action because it changes the result presentation without replacing the active scenario. Each scenario tab shows a short state indicator and an accessible label such as “Scenario A, Baseline, changes not run.” A dot alone is insufficient.

Recommended visible labels:

- `A · Baseline`
- `B · Intervention`
- `Compare`

State vocabulary is fixed:

- **Not run** — no completed result for these assumptions.
- **Current** — results match the visible assumptions.
- **Changes not run** — results exist, but inputs changed afterward.
- **Running 42%** — a run snapshot is executing.
- **Canceled** — last attempt was canceled; partial output was discarded.
- **Run failed** — last attempt failed; scenario inputs are intact.

### Assumption control

Every numeric assumption uses the same anatomy:

1. Plain-language label and optional help button.
2. Current numeric value with a persistent unit.
3. Range slider when the range is useful for exploration.
4. Synchronized numeric input for precision and non-drag operation.
5. Brief contextual note or inline validation message.

Example:

> **Treatment spaces**  
> Total spaces available for treatment and boarding.  
> `[slider]` `[24] spaces`

Do not put critical definitions exclusively in tooltips. Help popovers may explain the modeled meaning, illustrative default, and limit. They open on click/tap as well as keyboard, stay open until dismissed, and are not hover-only.

### Preset selector

The preset selector shows both name and provenance:

> Balanced baseline  
> Illustrative synthetic scenario

Applying a preset that replaces edited assumptions uses a confirmation dialog only if the active scenario has unsaved-to-local-state changes or unrun edits. The dialog names the scenario and offers “Apply preset” and “Keep current assumptions.”

### Metric cards

A metric card contains, in order:

- Metric name.
- Median across replications as the largest text.
- `10th–90th percentile across replications` range on the next line.
- Unit, eligible population if needed, and definition affordance.
- In Compare, A, B, absolute change, and appropriate percentage change.

Never display more precision than the model supports: whole patients/spaces, one decimal for hours and percentages, and whole minutes for waits by default. Exported data may retain additional machine precision.

Example:

> **Median wait for a treatment space**  
> **38 min**  
> 10th–90th percentile: 29–52 min

For an undefined metric:

> **N/A**  
> No eligible observations in this run.

### Interpretation panel

Title it **Model-bounded interpretation**. It is a deterministic summary, never advice. It identifies the first listed configured difference, describes the median-wait and boarder-hour shifts, and repeats material comparison caveats.

Approved pattern:

> Within this synthetic model, Intervention had a lower median wait for a treatment space, while boarder-hours were similar. The first listed configured difference was treatment spaces: 24 to 28. Results are conditional on these assumptions.

Avoid “improved,” “worsened,” “successful,” “should,” “will,” “proves,” or claims about patient outcomes unless the sentence explicitly and neutrally describes the model output.

### Changed-assumptions summary

Place this before comparison results. Group rows under Input, Throughput, and Output and show only differences by default:

| Assumption               | Baseline | Intervention |    Change |
| ------------------------ | -------: | -----------: | --------: |
| Treatment spaces         |       24 |           28 | +4 spaces |
| Median boarding duration |  240 min |      180 min |   −60 min |

On mobile, each row becomes a labeled card. “Show all assumptions” reveals unchanged inputs.

### Disclosure, popover, dialog, and toast

- **Disclosure/accordion:** supporting or advanced content in the document flow.
- **Popover:** brief help anchored to a control; never required to complete the form.
- **Dialog:** confirm destructive replacement/reset or inspect import errors. Trap focus, label the dialog, and return focus to the trigger.
- **Toast/live notice:** copy/download success only. Errors that require action are inline and persistent.

## 7. Chart system

### Shared chart rules

- Every chart has a sentence-case title, a short takeaway/subtitle, visible units, and a stable legend.
- The chart’s accessible name includes the scenario and analysis period.
- A concise text summary is adjacent to the chart. A “View data table” disclosure exposes the same values in semantic HTML.
- Color, line style, marker shape, and direct labels work together. Scenario A is a solid navy line with circle markers; Scenario B is a dashed teal line with square markers.
- Axes start from a defensible baseline. Bar charts start at zero. A truncated quantitative line axis must be clearly indicated and should be rare.
- Avoid dual axes. Use aligned small multiples when measures have different units.
- Show no more than four series at once. Optional boarder count is off initially if it would overload the arrival/departure chart.
- Hover/focus/touch details are anchored and collision-aware. Tooltips stay within the viewport, can be dismissed with Escape, and never contain information absent from the data table.
- Use a restrained 180 ms reveal at most. No animated counting, sweeping lines, or continuous motion.

### Uncertainty encoding

The headline value is the median of the per-replication metric. The interval is the 10th–90th percentile across replications. Label it exactly that way at least once per result section; after that, “10th–90th percentile” is sufficient.

- Time series: median line plus a low-opacity range band with an outlined edge.
- Metric cards: textual interval.
- Comparison: show A and B intervals beside each value; delta intervals only if the aggregation code calculates paired-replication deltas correctly.
- Do not call these confidence intervals.
- Do not imply patient-level percentiles when the interval is across replication summaries.

### System status over time

Use one card with two synchronized 24-hour plots at 15-minute bins:

1. **Occupied treatment spaces** — median occupied spaces, 10th–90th band, and a labeled capacity line.
2. **Patients waiting** — median queue length and its band.

This avoids putting spaces and patients on a dual axis. Scenario comparison defaults to A/B median lines; uncertainty bands may be toggled on and start muted to preserve legibility. A visible note says that the 24-hour warm-up is excluded.

Suggested accessible summary:

> Occupancy reached the configured capacity during the evening peak. The median waiting queue peaked at 14 patients near 8:15 PM. Values summarize 100 replications; ranges vary across replications.

The summary must be generated from computed values and omit sentences whose data are unavailable.

### Arrival and departure pattern

Use grouped hourly bars: filled blue bars for arrivals and outlined teal bars for departures. Optional boarder count is a separate small plot or toggle, not a third scale overlaid on the bars. For comparison, switch between scenarios rather than showing four bar series by default.

### Wait by acuity

Use a horizontal interval plot with High, Moderate, and Low acuity rows. A large marker shows median wait; a whisker shows the 10th–90th percentile across replication-level wait summaries. Tier name and numeric value remain visible. Preserve the priority order; do not sort tiers by result.

### Scenario comparison

The primary comparison is a semantic row layout, not a decorative bar chart. Each metric row shows:

- Baseline value and interval.
- Intervention value and interval.
- Absolute delta.
- Percentage delta only when the baseline is nonzero and the ratio is meaningful.
- Direction word: Higher, Lower, or Similar/no change.

Use arrows plus text, never arrows or color alone. Do not use a green/red scorecard. Let the user sort by domain or magnitude only after the default, conceptually ordered view remains available.

### Input–Throughput–Output map

Use three bordered nodes joined by a thin directional connector:

`Input: arrivals + acuity` → `Throughput: spaces + care duration` → `Output: admission + boarding`

An additional loop-back connector from Output to Throughput is labeled “Boarding continues to occupy a treatment space.” On mobile, stack the nodes and use a vertical connector. This is an explanatory diagram, not a live patient-flow animation.

### Sensitivity chart

Use 7–9 point markers, a connecting line, and an uncertainty band. Mark the active scenario’s value with a labeled reference line. State the replication count in the title area and include this note:

> One-at-a-time sensitivity analysis changes one assumption while holding the others fixed. It does not measure interactions among simultaneous changes.

## 8. Loading, empty, error, cancellation, and stale states

### State model

The UI distinguishes application loading, simulation running, result absence, result staleness, cancellation, model failure, and invalid imported state. A generic spinner or “Something went wrong” is not sufficient.

| State                     | Behavior                                                                                                                                                                                                                       | Recommended copy                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| App/code loading          | Reserve final layout dimensions. Use a short skeleton for lazy Sensitivity/Methodology content, not result numbers.                                                                                                            | “Loading methodology…”                                                                     |
| Never run                 | Show a small experiment primer and the main run action. Do not show zeroes as if they were results.                                                                                                                            | “Ready to explore the balanced baseline.”                                                  |
| Running                   | Snapshot assumptions; controls may remain editable if a persistent notice explains that edits apply to the next run. Show determinate progress and Cancel. Keep prior completed results labeled “Previous run” when available. | “This run uses the assumptions captured when it started. Any edits apply to the next run.” |
| Completed                 | Replace progress without layout shift; announce politely; retain provenance.                                                                                                                                                   | “Simulation complete. Results summarize 100 seeded replications.”                          |
| Changes not run           | Preserve results with a persistent stale notice.                                                                                                                                                                               | “Assumptions changed. Results below are from the previous run.”                            |
| Canceled, no prior result | Discard partial aggregates and return to ready state.                                                                                                                                                                          | “Run canceled. No partial results were saved.”                                             |
| Canceled, prior result    | Keep prior result visible and current/stale status intact.                                                                                                                                                                     | “Updated run canceled. Previous completed results are still shown.”                        |
| Worker/model error        | Preserve assumptions and prior result, offer Retry, and show a short diagnostic reference without a stack trace.                                                                                                               | “The simulation could not finish. Your scenario is unchanged.”                             |
| No eligible observations  | Render N/A, not 0 or NaN.                                                                                                                                                                                                      | “No eligible observations in this run.”                                                    |
| Invalid URL state         | Load safe defaults and show a dismissible persistent warning with details. Do not partially apply unknown values.                                                                                                              | “This shared scenario could not be read, so the balanced baseline was loaded instead.”     |
| Invalid import            | Do not replace current scenarios. List field-level problems and supported schema versions.                                                                                                                                     | “Import not applied. Fix the fields below or choose another file.”                         |
| Share/export failure      | Keep data intact; offer retry or manual copy where possible.                                                                                                                                                                   | “The link could not be copied. Select and copy it manually.”                               |

Progress updates use `role="progressbar"` with `aria-valuemin`, `aria-valuemax`, and `aria-valuenow`. A separate polite live region announces meaningful milestones (start, roughly each 25%, cancel, completion), not every replication.

Cancel is always available during a run. It stops future work, discards partial results, and never overwrites the last completed run. During an A/B run, show whether A, B, or both are in progress and let Cancel stop the entire paired experiment; partial comparisons are not presented as complete.

## 9. Accessibility and keyboard behavior

Target WCAG 2.2 AA. Automated tests help, but manual keyboard, screen-reader, contrast, zoom, and touch review are release requirements.

### Structure and navigation

- Use `header`, `nav`, `main`, complementary assumptions region, named results sections, and `footer` landmarks.
- Provide a first-focus “Skip to sandbox” link and, when results exist, “Skip to results.”
- Maintain one `h1`; headings descend without skipped levels.
- Scenario tabs, the pressed-state domain switcher, disclosures, dialogs, menus, and progress use their native element or correct ARIA pattern.
- The DOM order matches the visual and reading order at every breakpoint. CSS rearrangement must not create a contradictory focus order.
- Sticky headers and the mobile action dock cannot obscure focused elements (WCAG 2.4.11/2.4.12 intent). Use scroll padding and sufficient content insets.

### Keyboard interaction

- `Tab`/`Shift+Tab` moves through interactive controls in document order.
- Arrow keys move within tab lists, radio groups, sliders, and menu items according to established ARIA patterns.
- `Enter`/`Space` activates buttons and disclosures.
- `Escape` closes popovers, menus, and dialogs and restores focus to the trigger.
- Dialogs trap focus; non-modal disclosures do not.
- Run completion does not steal focus. The Run button changes to Cancel while running and returns to Run afterward without losing the logical focus position.
- Validation submission moves focus to a summary whose links focus the invalid fields. Each field also uses `aria-invalid` and `aria-describedby`.
- Chart summaries and “View data table” controls enter the normal tab order. Avoid making all 96 time points individual tab stops; expose point detail through a single chart control plus the data table.

### Forms and target size

- Every input has a programmatic label, current unit, allowed range, and associated help/error text.
- Placeholders never replace labels.
- Sliders always have synchronized numeric inputs. Custom profile charts always have numeric/block alternatives.
- Percentage groups announce the total and any validation state. Imported values are never silently corrected in the UI without a notice.
- Aim for 44 × 44 px primary targets. Meet the WCAG 2.2 24 × 24 CSS px minimum or provide sufficient spacing where compact chart controls require smaller visible shapes.
- Do not disable a primary action without explaining why. Prefer an enabled action that reveals specific validation errors.

### Visual access

- Normal text contrast is at least 4.5:1; large text at least 3:1; input borders, chart lines, focus indicators, and meaningful graphical objects at least 3:1 against adjacent colors.
- Focus rings are visible on both white and tinted surfaces and are never removed.
- State and domain meaning never rely on color alone. Use text, marker shape, line dash, and icons.
- Support 200% browser zoom and reflow at 320 CSS px without loss of content or two-dimensional page scrolling. Test critical tasks at 400% zoom where practical.
- Respect `prefers-reduced-motion`; no functionality depends on animation.
- Honor high-contrast/forced-colors mode for controls, focus, borders, and selected state.

### Screen readers and live content

- Metric values read as label, value, unit, and uncertainty interval in that order.
- Abbreviations such as “ED” and “N/A” have understandable accessible text where pronunciation is unreliable.
- Charts have a concise computed summary and a semantic data table. SVG marks that duplicate those forms are hidden from the accessibility tree unless the chart library provides a tested navigation model.
- Run state and copy/download completion use polite live regions; failed runs and blocking validation use assertive alerts sparingly.
- Tooltips opened from help buttons remain available on pointer, keyboard, and touch. Browser-title-only tooltips are not used.

## 10. Content design

### Persistent product copy

**Title**

> ED Throughput Sandbox

**Subtitle**

> Explore how demand, treatment capacity, care duration, admission pressure, and boarding interact in a simplified emergency-department flow model.

**Supporting line**

> Adjust a synthetic scenario, run repeated simulations, and compare operational tradeoffs—without using patient data.

**Why this exists**

> Crowding rarely has a single cause. This sandbox makes system interactions visible so users can test operational hypotheses before working with institution-specific data.

**Status labels**

> Synthetic model · No patient data · Educational use

**Footer disclaimer**

> This application is an educational systems-modeling project. It uses synthetic inputs and simplified assumptions, is not calibrated to any institution, and should not be used for staffing, clinical, regulatory, or operational decisions.

### Control copy

| Control         | Label                    | Supporting copy                                                                                           |
| --------------- | ------------------------ | --------------------------------------------------------------------------------------------------------- |
| Arrival rate    | Average arrivals         | “Mean patients arriving per hour across the day. The selected pattern redistributes this volume by hour.” |
| Arrival profile | Arrival pattern          | “Illustrative hourly pattern; its 24-hour average is normalized.”                                         |
| Acuity          | Acuity mix               | “Operational priority tiers used for queue ordering, not clinical triage categories.”                     |
| Spaces          | Treatment spaces         | “Total spaces available for treatment and for admitted patients who are boarding.”                        |
| Treatment scale | Care-duration scale      | “Adjusts the median treatment duration for all acuity tiers together.”                                    |
| Fast track      | Low-acuity fast track    | “Allocate spaces from the total; this does not add capacity.”                                             |
| Admission       | Overall admission rate   | “Weighted synthetic probability based on the current acuity mix.”                                         |
| Boarding        | Median boarding duration | “Time an admitted patient continues to occupy an ED treatment space after treatment.”                     |
| Replications    | Replications             | “Repeated seeded runs used to summarize stochastic variation.”                                            |
| Seed            | Master seed              | “Use the same seed to reproduce a scenario. A/B comparisons share this seed.”                             |

Fast-track allocation must say:

> Allocate **4 of 24 total spaces** to fast track.

Avoid “beds” when the model means treatment spaces, “door to provider” when it means wait for a treatment space, and “prediction” when it means simulated result.

### Buttons and actions

Use specific verb-first labels:

- Run simulation
- Run updated scenario
- Run both scenarios
- Cancel run
- Duplicate A into B
- Review changes
- Share link
- Export scenarios (.json)
- Export results (.csv)
- Print report
- Reset scenario
- New seed
- View methodology

Avoid generic “Submit,” “Continue,” “Process,” or “Generate insights.”

### Help text rules

- Put the operational meaning before the mathematical implementation.
- Mark defaults and presets with “Illustrative default” or “Illustrative synthetic scenario.”
- Use “Within this synthetic model…” for interpretations.
- Describe the 10th–90th percentile as variation across replications, not confidence or a likely real-hospital range.
- Never imply staffing advice, causal proof, clinical benefit, regulatory compliance, or institutional calibration.

## 11. Interaction and perceived performance

- Simulation runs only after an explicit Run action; sliders do not trigger simulation.
- During a run, execute an immutable assumption snapshot. Controls remain editable for the next run, accompanied by a persistent snapshot notice; edits must never mutate the in-flight job. Navigation, methodology, and Cancel remain available.
- Reserve chart and metric-card dimensions before results arrive to avoid layout shift.
- Show progress as completed replications. If worker setup takes noticeable time before the first replication, use “Preparing simulation…” briefly, then switch to determinate progress.
- Cache exact completed scenario/seed/replication combinations. Reusing a cache must look like a completed run and preserve provenance, not flash fake progress.
- Do not animate metric values or delay completed results for effect.
- Lazy-load Sensitivity and extended Methodology only if it measurably reduces initial cost; the primary Sandbox and its disclaimers must render immediately.

## 12. Visual and accessibility QA checklist

Inspect every required viewport with default, extreme, comparison, running, stale, N/A, error, and long-name states.

### 390 × 844

- No horizontal page scroll at 100%, 200%, or increased text spacing.
- Header labels wrap without colliding with navigation.
- Scenario and domain tabs remain understandable with long names.
- Numeric fields, units, and validation text do not clip.
- Bottom action dock remains visible, does not cover content, and works with safe-area inset.
- All chart legends, axes, data tables, and tooltips fit the viewport.
- Compare metrics use cards rather than a squeezed table.

### 768 × 1024

- Two-column form rows retain labels and touch targets; otherwise collapse cleanly.
- Bottom action dock does not obscure headings, keyboard focus, validation, or the footer.
- Charts stack when two columns would force truncated units or legends.
- No excessive blank area beside short controls or N/A results.

### 1440 × 900 and wide desktop

- Main controls and the first results are visible early without an oversized hero.
- Assumptions rail never creates a competing nested scrollbar.
- Metric rows align without making labels tiny.
- Charts do not become excessively wide; unused width adds explanation or comparison context.
- Sticky elements do not overlap the footer, dialogs, or focused controls.

### Manual accessibility pass

- Complete first run, edit/rerun, duplicate/compare, export, import failure, and cancel using keyboard only.
- Test a representative screen reader flow through header, scenario tabs, controls, progress, metrics, chart summary, and data table.
- Check normal, hover, focus, selected, disabled, error, and forced-colors states.
- Verify contrast for text, controls, charts, uncertainty bands, and focus indicators with measured values.
- Test reduced motion, 200% zoom, 320 CSS px reflow, text spacing overrides, and touch tooltips.
- Confirm live announcements are useful and not repetitive.

## 13. First implementation priorities

For the first polished pass, prioritize:

1. A compact orientation hero, persistent trust labels, and an Input → Throughput → Output map in the ready/results area.
2. A stable scenario action bar with explicit Current/Changes not run/Running states.
3. A plain-language assumptions editor with numeric alternatives to every slider.
4. Result cards that pair point estimates with 10th–90th percentile intervals.
5. A two-plot system-status chart that avoids dual axes.
6. Changed assumptions before neutral A/B outcome deltas.
7. Persistent stale, demand-difference, error, and educational-scope notices.
8. A mobile run dock and a semantic comparison table visually restyled as cards at 390 px.
9. Chart text summaries and semantic data disclosures.
10. One visual refinement pass after screenshots at all four required viewport sizes.

This design intentionally favors clarity, provenance, and careful interpretation over the density of a conventional operations dashboard.

## 14. Implementation reconciliation

The stable implementation intentionally adopts the following decisions from the visual-refinement pass:

- Sandbox is the single page; Methodology and Sensitivity are focus-trapped dialogs that return focus to their triggers.
- At 900 px and below, a segmented domain switcher replaces the permanent assumptions rail, and Run/Cancel moves to the bottom action dock.
- Simulations use immutable snapshots while the controls remain editable for the next run; a visible notice explains this behavior.
- Eight headline metrics and seven open-by-default additional measures use four-column desktop and two-column compact grids.
- Comparison remains one semantic table in the DOM and is visually transformed into card-like rows on narrow screens.
- System and flow charts include full semantic data disclosures; comparison flow uses an explicit scenario selector instead of four simultaneous bar series.
- Browser automation is configured for 390 × 844, 768 × 1024, 1440 × 900, and 1728 × 1000.

This reconciliation records accepted product decisions, not release evidence. The viewport, zoom, screen-reader, state, and deployed-browser checks in `docs/QA.md` remain required before release. Requirements elsewhere in this document remain normative unless superseded above.
