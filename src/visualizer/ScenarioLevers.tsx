import { ESI_LEVELS, type ScenarioConfigV2 } from '../simulation/v2/types';

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

  return (
    <aside className="visualizer-setup" aria-labelledby="setup-title">
      <div className="panel-heading-row">
        <div>
          <span className="section-kicker">Experiment</span>
          <h2 id="setup-title">Quick levers</h2>
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
        Adjust assumptions, then rerun. Each control below states exactly what changes in the model.
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

      <section className="lever-group" aria-labelledby="output-levers">
        <h3 id="output-levers">Output</h3>
        <Lever
          label="Dedicated boarding spaces"
          value={scenario.capacities.boardingBeds}
          min={0}
          max={24}
          disabled={disabled}
          detail="A free boarding space releases the original treatment room. When full, the admitted patient blocks that room."
          onChange={(value) => updateCapacity('boardingBeds', value)}
        />
        <Lever
          label="Median inpatient delay"
          value={scenario.durations.boardingMedian}
          min={30}
          max={900}
          step={30}
          suffix="min"
          disabled={disabled}
          detail="Changes the aggregate post-admission delay; downstream inpatient units are not simulated yet."
          onChange={(value) =>
            onChange({ ...scenario, durations: { ...scenario.durations, boardingMedian: value } })
          }
        />
      </section>

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
          ESI mix:{' '}
          {ESI_LEVELS.map(
            (esi) => `ESI ${esi} ${Math.round(scenario.demand.esiMix[esi] * 100)}%`,
          ).join(' · ')}
          .
        </p>
        <p>
          Staffing and cost are deliberately omitted. Any added bed, room, or machine assumes
          matching staff and support capacity.
        </p>
      </details>
    </aside>
  );
}
