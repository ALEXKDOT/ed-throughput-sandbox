import { useId, useState } from 'react';
import { PRESETS, type PresetKey } from '../../presets/scenarios';
import {
  ADMISSION_CAPS,
  scaleAdmissionRates,
  weightedAdmissionRate,
} from '../../simulation/admission';
import type { AcuityTier, ScenarioConfig, TierValues } from '../../simulation/types';
import { SliderField, snapToStep } from '../../components/SliderField';

interface AssumptionsPanelProps {
  scenario: ScenarioConfig;
  onChange: (scenario: ScenarioConfig) => void;
  onGlobalSettings: (settings: { replications?: number; seed?: number }) => void;
  onPreset: (key: PresetKey) => void;
  onNewSeed: () => void;
  running?: boolean;
}

const PROFILE_LABELS = {
  flat: 'Flat',
  daytime: 'Daytime peak',
  evening: 'Evening peak',
  overnight: 'Overnight-heavy',
  custom: 'Custom six-block profile',
};

function DomainHeading({
  domain,
  title,
  description,
}: {
  domain: 'input' | 'throughput' | 'output';
  title: string;
  description: string;
}) {
  return (
    <div className={`domain-heading domain-heading--${domain}`}>
      <span
        className={`domain-symbol domain-symbol--${domain === 'input' ? 'circle' : domain === 'throughput' ? 'square' : 'diamond'}`}
        aria-hidden="true"
      />
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

export function AssumptionsPanel({
  scenario,
  onChange,
  onGlobalSettings,
  onPreset,
  onNewSeed,
  running = false,
}: AssumptionsPanelProps) {
  const customId = useId();
  const [compactDomain, setCompactDomain] = useState<'input' | 'throughput' | 'output'>('input');
  const patch = (value: Partial<ScenarioConfig>) => onChange({ ...scenario, ...value });
  const updateMix = (tier: AcuityTier, percent: number) => {
    const target = snapToStep(percent, 0, 100, 1) / 100;
    const others = (['high', 'moderate', 'low'] as const).filter((item) => item !== tier);
    const currentOther = others.reduce((sum, item) => sum + scenario.acuityMix[item], 0);
    const remaining = 1 - target;
    const next: TierValues = { ...scenario.acuityMix, [tier]: target };
    for (const item of others) {
      next[item] =
        currentOther > 0 ? (scenario.acuityMix[item] / currentOther) * remaining : remaining / 2;
    }
    patch({ acuityMix: next });
  };
  const overallAdmission = weightedAdmissionRate(scenario.admissionRates, scenario.acuityMix);
  const maximumAdmission = weightedAdmissionRate(ADMISSION_CAPS, scenario.acuityMix);

  return (
    <aside className="assumptions" id="assumptions-panel" aria-labelledby="assumptions-title">
      <div className="assumptions-intro">
        <div>
          <span className="section-kicker">Synthetic assumptions</span>
          <h2 id="assumptions-title">Configure the model</h2>
        </div>
        <label className="preset-select">
          <span>Illustrative preset</span>
          <select
            value=""
            onChange={(event) => {
              if (event.target.value) onPreset(event.target.value as PresetKey);
            }}
          >
            <option value="" disabled>
              Choose preset…
            </option>
            {Object.entries(PRESETS).map(([key, value]) => (
              <option key={key} value={key}>
                {value.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="assumption-note">
        All values are illustrative defaults, not benchmarks and not calibrated to an institution.
      </p>
      {running && (
        <p className="assumption-note assumption-note--running" role="status">
          This run uses the assumptions captured when it started. Any edits apply to the next run.
        </p>
      )}

      <div className="domain-switcher" aria-label="Assumption domains">
        {(['input', 'throughput', 'output'] as const).map((domain) => (
          <button
            key={domain}
            type="button"
            aria-pressed={compactDomain === domain}
            aria-controls={`domain-${domain}`}
            onClick={() => setCompactDomain(domain)}
          >
            {domain[0]!.toUpperCase() + domain.slice(1)}
          </button>
        ))}
      </div>

      <section
        id="domain-input"
        className={`domain-card domain-card--input${compactDomain === 'input' ? ' is-compact-active' : ''}`}
      >
        <DomainHeading domain="input" title="Input" description="Who arrives, and when" />
        <div className="domain-card-body">
          <SliderField
            label="Mean arrivals"
            value={scenario.arrivalRate}
            minimum={1}
            maximum={25}
            step={0.5}
            unit="patients/hr"
            hint="Average across the full day; the selected profile redistributes this volume by hour."
            onChange={(arrivalRate) => patch({ arrivalRate })}
          />
          <label className="select-field">
            <span>Arrival pattern</span>
            <select
              value={scenario.arrivalProfile}
              onChange={(event) =>
                patch({ arrivalProfile: event.target.value as ScenarioConfig['arrivalProfile'] })
              }
            >
              {Object.entries(PROFILE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {scenario.arrivalProfile === 'custom' && (
            <fieldset className="custom-profile" aria-describedby={`${customId}-hint`}>
              <legend>Four-hour arrival multipliers</legend>
              <p id={`${customId}-hint`} className="field-hint">
                Values are normalized automatically so their daily mean equals 1.0.
              </p>
              <div className="profile-bars" aria-hidden="true">
                {scenario.customArrivalBlocks.map((value, index) => (
                  <span key={index} style={{ height: `${Math.max(8, (value / 3) * 100)}%` }} />
                ))}
              </div>
              <div className="six-block-grid">
                {scenario.customArrivalBlocks.map((value, index) => (
                  <label key={index}>
                    <span>{String(index * 4).padStart(2, '0')}:00</span>
                    <input
                      type="number"
                      min="0.1"
                      max="3"
                      step="0.1"
                      value={value}
                      onChange={(event) => {
                        const next = [
                          ...scenario.customArrivalBlocks,
                        ] as ScenarioConfig['customArrivalBlocks'];
                        next[index] = snapToStep(Number(event.target.value), 0.1, 3, 0.1);
                        patch({ customArrivalBlocks: next });
                      }}
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <fieldset className="three-column-fields">
            <legend>Acuity mix</legend>
            {(['high', 'moderate', 'low'] as const).map((tier) => (
              <label key={tier}>
                <span>{tier[0]!.toUpperCase() + tier.slice(1)}</span>
                <span className="number-wrap">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={Math.round(scenario.acuityMix[tier] * 100)}
                    onChange={(event) => updateMix(tier, Number(event.target.value))}
                  />
                  <span>%</span>
                </span>
              </label>
            ))}
            <p className="field-hint span-all">
              Editing one tier redistributes the remaining percentage proportionally.
            </p>
          </fieldset>
        </div>
      </section>

      <section
        id="domain-throughput"
        className={`domain-card domain-card--throughput${compactDomain === 'throughput' ? ' is-compact-active' : ''}`}
      >
        <DomainHeading
          domain="throughput"
          title="Throughput"
          description="Where treatment happens, and for how long"
        />
        <div className="domain-card-body">
          <SliderField
            label="Total treatment spaces"
            value={scenario.totalSpaces}
            minimum={5}
            maximum={80}
            step={1}
            unit="spaces"
            onChange={(totalSpaces) =>
              patch({
                totalSpaces,
                fastTrack: {
                  ...scenario.fastTrack,
                  spaces: Math.min(scenario.fastTrack.spaces, totalSpaces - 1),
                },
              })
            }
          />
          <SliderField
            label="Treatment-time scale"
            value={scenario.treatmentTimeScale * 100}
            minimum={50}
            maximum={150}
            step={5}
            unit="%"
            hint="Scales all three main-space treatment medians together."
            onChange={(value) => {
              const requested = value / 100;
              const minimumAllowed = Math.max(
                0.25,
                ...Object.values(scenario.treatmentMedians).map((median) => 5 / median),
              );
              const maximumAllowed = Math.min(
                2,
                ...Object.values(scenario.treatmentMedians).map((median) => 1440 / median),
              );
              patch({
                treatmentTimeScale: Math.max(minimumAllowed, Math.min(maximumAllowed, requested)),
              });
            }}
          />
          <label className="toggle-field">
            <input
              type="checkbox"
              checked={scenario.fastTrack.enabled}
              onChange={(event) =>
                patch({ fastTrack: { ...scenario.fastTrack, enabled: event.target.checked } })
              }
            />
            <span>
              <strong>Enable low-acuity fast track</strong>
              <small>Spaces are reallocated from the total above—not added.</small>
            </span>
          </label>
          {scenario.fastTrack.enabled && (
            <div className="nested-controls">
              <SliderField
                label="Allocate to fast track"
                value={scenario.fastTrack.spaces}
                minimum={1}
                maximum={Math.max(1, scenario.totalSpaces - 1)}
                step={1}
                unit={`of ${scenario.totalSpaces}`}
                onChange={(spaces) => patch({ fastTrack: { ...scenario.fastTrack, spaces } })}
              />
              <SliderField
                label="Fast-track median duration"
                value={scenario.fastTrack.medianMinutes}
                minimum={5}
                maximum={720}
                step={5}
                unit="min"
                onChange={(medianMinutes) =>
                  patch({ fastTrack: { ...scenario.fastTrack, medianMinutes } })
                }
              />
            </div>
          )}
        </div>
      </section>

      <section
        id="domain-output"
        className={`domain-card domain-card--output${compactDomain === 'output' ? ' is-compact-active' : ''}`}
      >
        <DomainHeading
          domain="output"
          title="Output"
          description="Who is admitted, and how long spaces remain blocked"
        />
        <div className="domain-card-body">
          <SliderField
            label="Weighted admission rate"
            value={overallAdmission * 100}
            minimum={0}
            maximum={Math.round(maximumAdmission * 100)}
            step={1}
            unit="%"
            hint="Preserves the relative tier pattern until a documented tier cap is reached."
            onChange={(value) =>
              patch({ admissionRates: scaleAdmissionRates(value / 100, scenario) })
            }
          />
          <SliderField
            label="Median boarding duration"
            value={scenario.boardingMedianMinutes}
            minimum={0}
            maximum={1440}
            step={30}
            unit="min"
            hint="Admitted patients continue occupying their ED treatment space during this interval."
            onChange={(boardingMedianMinutes) => patch({ boardingMedianMinutes })}
          />
        </div>
      </section>

      <details className="advanced-controls">
        <summary>Advanced assumptions</summary>
        <div className="advanced-body">
          <fieldset className="three-column-fields">
            <legend>Tier treatment medians</legend>
            {(['high', 'moderate', 'low'] as const).map((tier) => {
              const minimumMedian = Math.max(5, Math.ceil(5 / scenario.treatmentTimeScale));
              const maximumMedian = Math.min(1440, Math.floor(1440 / scenario.treatmentTimeScale));
              return (
                <label key={tier}>
                  <span>{tier[0]!.toUpperCase() + tier.slice(1)}</span>
                  <span className="number-wrap">
                    <input
                      type="number"
                      min={minimumMedian}
                      max={maximumMedian}
                      step="5"
                      value={scenario.treatmentMedians[tier]}
                      onChange={(event) =>
                        patch({
                          treatmentMedians: {
                            ...scenario.treatmentMedians,
                            [tier]: snapToStep(
                              Number(event.target.value),
                              minimumMedian,
                              maximumMedian,
                              5,
                            ),
                          },
                        })
                      }
                    />
                    <span>min</span>
                  </span>
                </label>
              );
            })}
          </fieldset>
          <label className="select-field">
            <span>Treatment-duration variability</span>
            <select
              value={scenario.treatmentVariability}
              onChange={(event) =>
                patch({
                  treatmentVariability: event.target
                    .value as ScenarioConfig['treatmentVariability'],
                })
              }
            >
              <option value="low">Low variability</option>
              <option value="moderate">Moderate variability</option>
              <option value="high">High variability</option>
            </select>
          </label>
          <fieldset className="three-column-fields">
            <legend>Tier admission probabilities</legend>
            {(['high', 'moderate', 'low'] as const).map((tier) => (
              <label key={tier}>
                <span>{tier[0]!.toUpperCase() + tier.slice(1)}</span>
                <span className="number-wrap">
                  <input
                    type="number"
                    min="0"
                    max={ADMISSION_CAPS[tier] * 100}
                    step="1"
                    value={Math.round(scenario.admissionRates[tier] * 100)}
                    onChange={(event) =>
                      patch({
                        admissionRates: {
                          ...scenario.admissionRates,
                          [tier]: Math.max(
                            0,
                            Math.min(
                              ADMISSION_CAPS[tier],
                              snapToStep(Number(event.target.value), 0, 100, 1) / 100,
                            ),
                          ),
                        },
                      })
                    }
                  />
                  <span>%</span>
                </span>
              </label>
            ))}
          </fieldset>
          <SliderField
            label="Monte Carlo replications"
            value={scenario.replications}
            minimum={20}
            maximum={200}
            step={10}
            unit="runs"
            hint="A/B comparisons use this shared replication count and paired seed structure."
            onChange={(replications) => onGlobalSettings({ replications })}
          />
          <div className="seed-field">
            <label>
              <span>Master seed</span>
              <input
                type="number"
                min="1"
                max="4294967295"
                step="1"
                value={scenario.seed}
                onChange={(event) =>
                  onGlobalSettings({
                    seed: snapToStep(Number(event.target.value), 1, 4_294_967_295, 1),
                  })
                }
              />
            </label>
            <button type="button" className="secondary-button" onClick={onNewSeed}>
              New seed
            </button>
          </div>
        </div>
      </details>
    </aside>
  );
}
