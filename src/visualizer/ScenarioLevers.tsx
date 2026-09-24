import { diagnosticCapacityEstimatesV2 } from '../simulation/v2/capacityAnalysis';
import {
  ESI_LEVELS,
  PATHWAY_KINDS,
  type PathwayKind,
  type ScenarioConfigV2,
} from '../simulation/v2/types';
import { rebalanceEsiMix } from './scenarioEditing';

interface ScenarioLeversProps {
  scenarios: Record<'a' | 'b', ScenarioConfigV2>;
  activeSlot: 'a' | 'b';
  stale: Partial<Record<'a' | 'b', boolean>>;
  disabled: boolean;
  onSelectSlot: (slot: 'a' | 'b') => void;
  onChange: (scenario: ScenarioConfigV2) => void;
  onClone: () => void;
  onNewSeed: () => void;
}

interface LeverProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  detail: string;
  disabled: boolean;
  onChange: (value: number) => void;
}

interface AssumptionInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  disabled: boolean;
  onChange: (value: number) => void;
}

const PATHWAY_LABELS: Record<PathwayKind, string> = {
  minorInjury: 'Minor injury',
  medical: 'Medical',
  abdominal: 'Abdominal',
  behavioralHealth: 'Behavioral health',
};

function AssumptionInput({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  disabled,
  onChange,
}: AssumptionInputProps) {
  return (
    <label className="assumption-input">
      <span>{label}</span>
      <span className="assumption-input__control">
        <input
          type="number"
          aria-label={label}
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        {suffix && <small>{suffix}</small>}
      </span>
    </label>
  );
}

function DiagnosticCapacityCheck({ scenario }: { scenario: ScenarioConfigV2 }) {
  const estimates = diagnosticCapacityEstimatesV2(scenario);
  const stressed = estimates.filter((estimate) => estimate.pressure !== 'balanced');
  const overallPressure = estimates.some((estimate) => estimate.pressure === 'overloaded')
    ? 'overloaded'
    : stressed.length > 0
      ? 'tight'
      : 'balanced';
  return (
    <section className="capacity-check" aria-labelledby="capacity-check-title">
      <div className="capacity-check__heading">
        <h3 id="capacity-check-title">Diagnostic capacity check</h3>
        <span className={`capacity-check__state capacity-check__state--${overallPressure}`}>
          {overallPressure === 'overloaded'
            ? 'Over capacity'
            : stressed.length > 0
              ? 'Tight'
              : 'Balanced'}
        </span>
      </div>
      <div className="capacity-check__meters">
        {estimates.map((estimate) => (
          <div className="capacity-meter" key={estimate.key}>
            <span>{estimate.label}</span>
            <strong className={`capacity-meter--${estimate.pressure}`}>
              {Math.round(estimate.utilization * 100)}%
            </strong>
          </div>
        ))}
      </div>
      <p>
        Approximate steady-state load from the current mix and median service times. At 100% or
        more, queues are expected to keep growing.
      </p>
    </section>
  );
}

function Lever({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  detail,
  disabled,
  onChange,
}: LeverProps) {
  return (
    <div className="visualizer-lever">
      <label>
        <span>{label}</span>
        <span className="lever-value">
          <input
            type="number"
            aria-label={`${label}, numeric value`}
            min={min}
            max={max}
            step={step}
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(Number(event.target.value))}
          />
          {suffix}
        </span>
      </label>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <small>{detail}</small>
    </div>
  );
}

export function ScenarioLevers({
  scenarios,
  activeSlot,
  stale,
  disabled,
  onSelectSlot,
  onChange,
  onClone,
  onNewSeed,
}: ScenarioLeversProps) {
  const scenario = scenarios[activeSlot];
  const updateCapacity = (key: keyof ScenarioConfigV2['capacities'], value: number) =>
    onChange({ ...scenario, capacities: { ...scenario.capacities, [key]: value } });
  const updateDuration = (key: keyof ScenarioConfigV2['durations'], value: number) =>
    onChange({ ...scenario, durations: { ...scenario.durations, [key]: value } });
  const updateDiagnosticProbability = (
    key: Exclude<keyof ScenarioConfigV2['diagnosticProbabilities'], 'labByPathway'>,
    percent: number,
  ) =>
    onChange({
      ...scenario,
      diagnosticProbabilities: {
        ...scenario.diagnosticProbabilities,
        [key]: Math.max(0, Math.min(100, percent)) / 100,
      },
    });

  return (
    <aside className="visualizer-setup" aria-labelledby="setup-title">
      <div className="panel-heading-row">
        <div>
          <span className="section-kicker">Assumptions</span>
          <h2 id="setup-title">Scenario settings</h2>
        </div>
        {stale[activeSlot] && (
          <span className="configuration-state configuration-state--stale">Changes not run</span>
        )}
      </div>
      <div className="lever-scenario-tabs" role="group" aria-label="Edit scenario">
        <button
          type="button"
          className={activeSlot === 'a' ? 'is-active' : ''}
          onClick={() => onSelectSlot('a')}
        >
          A · Baseline
        </button>
        <button
          type="button"
          className={activeSlot === 'b' ? 'is-active' : ''}
          onClick={() => onSelectSlot('b')}
        >
          B · Intervention
        </button>
      </div>
      <p className="panel-description">
        Set assumptions for the selected scenario, then run the simulation.
      </p>

      <section className="lever-group" aria-labelledby="demand-levers">
        <h3 id="demand-levers">Demand</h3>
        <Lever
          label="Average arrivals"
          value={scenario.demand.meanArrivalsPerHour}
          min={2}
          max={14}
          step={0.5}
          suffix="/hr"
          disabled={disabled}
          detail="Changes the mean of the time-varying arrival process; the daily shape and ESI mix stay fixed."
          onChange={(value) =>
            onChange({ ...scenario, demand: { ...scenario.demand, meanArrivalsPerHour: value } })
          }
        />
      </section>

      <section className="lever-group" aria-labelledby="space-levers">
        <h3 id="space-levers">Care spaces</h3>
        <Lever
          label="Main treatment rooms"
          value={scenario.capacities.mainRooms}
          min={8}
          max={36}
          disabled={disabled}
          detail="Adds or removes individually modeled rooms available to ESI 1–5 patients."
          onChange={(value) => updateCapacity('mainRooms', value)}
        />
        <Lever
          label="Fast-track spaces"
          value={scenario.capacities.fastTrackSpaces}
          min={0}
          max={12}
          disabled={disabled}
          detail="Adds ESI 4–5 spaces. These are additive; they are not taken from the main-room total."
          onChange={(value) => updateCapacity('fastTrackSpaces', value)}
        />
        <Lever
          label="Hallway spaces"
          value={scenario.capacities.hallwayBeds}
          min={0}
          max={16}
          disabled={disabled}
          detail="Changes addressable hallway treatment spaces that follow the same room queue."
          onChange={(value) => updateCapacity('hallwayBeds', value)}
        />
        <Lever
          label="Care-duration scale"
          value={scenario.durations.globalScale}
          min={0.5}
          max={1.75}
          step={0.05}
          suffix="×"
          disabled={disabled}
          detail="Multiplies future triage, treatment, diagnostic, reassessment, and discharge durations."
          onChange={(value) =>
            onChange({ ...scenario, durations: { ...scenario.durations, globalScale: value } })
          }
        />
      </section>

      <section className="lever-group" aria-labelledby="diagnostic-levers">
        <h3 id="diagnostic-levers">Diagnostics</h3>
        <Lever
          label="CT scanners"
          value={scenario.capacities.ctScanners}
          min={1}
          max={4}
          disabled={disabled}
          detail="Changes the number of CT queues served in parallel. The ED room remains reserved during imaging."
          onChange={(value) => updateCapacity('ctScanners', value)}
        />
        <Lever
          label="Lab processors"
          value={scenario.capacities.labProcessors}
          min={1}
          max={6}
          disabled={disabled}
          detail="Changes parallel lab-processing capacity; patients remain in their treatment location."
          onChange={(value) => updateCapacity('labProcessors', value)}
        />
      </section>

      <DiagnosticCapacityCheck scenario={scenario} />

      <section className="lever-group" aria-labelledby="output-levers">
        <h3 id="output-levers">Output</h3>
        <Lever
          label="Off-room boarding spaces"
          value={scenario.capacities.boardingBeds}
          min={0}
          max={80}
          disabled={disabled}
          detail="These finite spaces release treatment rooms. Total boarder census is uncapped; excess boarders continue to hold care spaces."
          onChange={(value) => updateCapacity('boardingBeds', value)}
        />
        <Lever
          label="Median inpatient delay"
          value={scenario.durations.boardingMedian}
          min={30}
          max={4320}
          step={10}
          suffix="min"
          disabled={disabled}
          detail="Changes the synthetic post-admission delay, up to 72 hours. Downstream inpatient units are not simulated."
          onChange={(value) =>
            onChange({ ...scenario, durations: { ...scenario.durations, boardingMedian: value } })
          }
        />
      </section>

      <details className="lever-disclosure advanced-assumptions">
        <summary>Advanced clinical-flow assumptions</summary>
        <p className="assumption-note">
          These inputs define individual stages. Total length of stay emerges from care time,
          diagnostic queues, reassessment, disposition, and boarding; it is not entered directly.
        </p>

        <section className="assumption-section" aria-labelledby="esi-assumptions-title">
          <h3 id="esi-assumptions-title">ESI mix, care time, and admissions</h3>
          <p>Changing one ESI share proportionally rebalances the other four to keep 100%.</p>
          <div className="assumption-table" role="group" aria-label="ESI assumptions">
            <div className="assumption-table__header" aria-hidden="true">
              <span>Level</span>
              <span>Mix</span>
              <span>Initial care</span>
              <span>Admit</span>
            </div>
            {ESI_LEVELS.map((esi) => (
              <div className="assumption-table__row" key={esi}>
                <strong>ESI {esi}</strong>
                <AssumptionInput
                  label={`ESI ${esi} share, percent`}
                  value={Number((scenario.demand.esiMix[esi] * 100).toFixed(1))}
                  min={0}
                  max={100}
                  step={0.5}
                  suffix="%"
                  disabled={disabled}
                  onChange={(value) =>
                    onChange({
                      ...scenario,
                      demand: {
                        ...scenario.demand,
                        esiMix: rebalanceEsiMix(scenario.demand.esiMix, esi, value),
                      },
                    })
                  }
                />
                <AssumptionInput
                  label={`ESI ${esi} initial treatment median, minutes`}
                  value={scenario.durations.treatmentMedianByEsi[esi]}
                  min={1}
                  max={1440}
                  step={5}
                  suffix="min"
                  disabled={disabled}
                  onChange={(value) =>
                    onChange({
                      ...scenario,
                      durations: {
                        ...scenario.durations,
                        treatmentMedianByEsi: {
                          ...scenario.durations.treatmentMedianByEsi,
                          [esi]: value,
                        },
                      },
                    })
                  }
                />
                <AssumptionInput
                  label={`ESI ${esi} admission probability, percent`}
                  value={Number((scenario.admissionRates[esi] * 100).toFixed(1))}
                  min={0}
                  max={100}
                  step={0.5}
                  suffix="%"
                  disabled={disabled}
                  onChange={(value) =>
                    onChange({
                      ...scenario,
                      admissionRates: {
                        ...scenario.admissionRates,
                        [esi]: Math.max(0, Math.min(100, value)) / 100,
                      },
                    })
                  }
                />
              </div>
            ))}
          </div>
        </section>

        <section className="assumption-section" aria-labelledby="pathway-assumptions-title">
          <h3 id="pathway-assumptions-title">Pathway care-time multipliers</h3>
          <p>Applied to the ESI-specific initial-care median for that pathway only.</p>
          <div className="assumption-grid assumption-grid--two">
            {PATHWAY_KINDS.map((pathway) => (
              <AssumptionInput
                key={pathway}
                label={`${PATHWAY_LABELS[pathway]} care-time multiplier`}
                value={scenario.pathwayTreatmentMultipliers[pathway]}
                min={0.25}
                max={4}
                step={0.05}
                suffix="×"
                disabled={disabled}
                onChange={(value) =>
                  onChange({
                    ...scenario,
                    pathwayTreatmentMultipliers: {
                      ...scenario.pathwayTreatmentMultipliers,
                      [pathway]: value,
                    },
                  })
                }
              />
            ))}
          </div>
        </section>

        <section className="assumption-section" aria-labelledby="stage-times-title">
          <h3 id="stage-times-title">Other stage medians</h3>
          <div className="assumption-grid assumption-grid--two">
            {(
              [
                ['triageMedian', 'Triage median'],
                ['reassessmentMedian', 'Reassessment median'],
                ['ctMedian', 'CT median'],
                ['mriMedian', 'MRI median'],
                ['xrayMedian', 'X-ray median'],
                ['ultrasoundMedian', 'Ultrasound median'],
                ['labMedian', 'Lab median'],
                ['dischargeLoungeMedian', 'Discharge-lounge median'],
              ] as const
            ).map(([key, label]) => (
              <AssumptionInput
                key={key}
                label={`${label}, minutes`}
                value={scenario.durations[key]}
                min={1}
                max={1440}
                step={1}
                suffix="min"
                disabled={disabled}
                onChange={(value) => updateDuration(key, value)}
              />
            ))}
          </div>
        </section>

        <section className="assumption-section" aria-labelledby="diagnostic-orders-title">
          <h3 id="diagnostic-orders-title">Diagnostic-order probabilities</h3>
          <p>Probabilities are conditional on the synthetic pathway shown in each label.</p>
          <div className="assumption-grid assumption-grid--two">
            {PATHWAY_KINDS.map((pathway) => (
              <AssumptionInput
                key={`lab-${pathway}`}
                label={`${PATHWAY_LABELS[pathway]} lab order, percent`}
                value={Number(
                  (scenario.diagnosticProbabilities.labByPathway[pathway] * 100).toFixed(1),
                )}
                min={0}
                max={100}
                step={0.5}
                suffix="%"
                disabled={disabled}
                onChange={(value) =>
                  onChange({
                    ...scenario,
                    diagnosticProbabilities: {
                      ...scenario.diagnosticProbabilities,
                      labByPathway: {
                        ...scenario.diagnosticProbabilities.labByPathway,
                        [pathway]: Math.max(0, Math.min(100, value)) / 100,
                      },
                    },
                  })
                }
              />
            ))}
            {(
              [
                ['xrayMinorInjury', 'Minor injury X-ray'],
                ['ctMedicalHighAcuity', 'ESI 1–2 medical CT'],
                ['ctMedicalOther', 'ESI 3–5 medical CT'],
                ['ctAbdominal', 'Abdominal CT'],
                ['ultrasoundAbdominal', 'Abdominal ultrasound'],
                ['mriMedical', 'Medical MRI'],
                ['mriBehavioralHealth', 'Behavioral-health MRI'],
              ] as const
            ).map(([key, label]) => (
              <AssumptionInput
                key={key}
                label={`${label} order, percent`}
                value={Number((scenario.diagnosticProbabilities[key] * 100).toFixed(1))}
                min={0}
                max={100}
                step={0.5}
                suffix="%"
                disabled={disabled}
                onChange={(value) => updateDiagnosticProbability(key, value)}
              />
            ))}
          </div>
        </section>
      </details>

      <button
        className="secondary-button full-width-button"
        type="button"
        onClick={onClone}
        disabled={disabled}
      >
        Copy A into intervention B
      </button>
      <details className="lever-disclosure">
        <summary>Model detail and run setup</summary>
        <div className="run-setup-grid">
          <label>
            Replications
            <input
              type="number"
              min="10"
              max="100"
              value={scenario.replications}
              disabled={disabled}
              onChange={(event) =>
                onChange({ ...scenario, replications: Number(event.target.value) })
              }
            />
          </label>
          <label>
            Shared seed
            <input
              type="number"
              min="1"
              max="4294967295"
              value={scenario.seed}
              disabled={disabled}
              onChange={(event) => onChange({ ...scenario, seed: Number(event.target.value) })}
            />
          </label>
        </div>
        <button className="text-button" type="button" onClick={onNewSeed} disabled={disabled}>
          Generate new shared seed
        </button>
        <p>
          Staffing and cost are not modeled. Any added bed, room, or machine assumes matching staff
          and support capacity.
        </p>
      </details>
    </aside>
  );
}
