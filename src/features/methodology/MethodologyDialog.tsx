import { useEffect, useRef, useState } from 'react';
import { trapFocus } from '../../utilities/focusTrap';
import { resolveHourlyProfile } from '../../presets/profiles';
import type { ScenarioConfig } from '../../simulation/types';

interface MethodologyDialogProps {
  open: boolean;
  scenario: ScenarioConfig;
  onClose: () => void;
}

export function MethodologyDialog({ open, scenario, onClose }: MethodologyDialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const [section, setSection] = useState<'model' | 'limits' | 'sources'>('model');
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    window.setTimeout(() => closeRef.current?.focus(), 0);
    return () => previous?.focus();
  }, [open]);
  if (!open) return null;
  const hourlyProfile = resolveHourlyProfile(scenario.arrivalProfile, scenario.customArrivalBlocks);
  const repositoryUrl = import.meta.env.VITE_REPOSITORY_URL as string | undefined;
  const sourceMapUrl = repositoryUrl ? `${repositoryUrl}/blob/main/docs/SOURCES.md` : undefined;

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="methodology-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="methodology-title"
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
          trapFocus(event, dialogRef.current);
        }}
      >
        <div className="dialog-header">
          <div>
            <span className="section-kicker">Transparent by design</span>
            <h2 id="methodology-title">Methodology</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close methodology"
          >
            ×
          </button>
        </div>
        <div className="methodology-layout">
          <nav aria-label="Methodology sections">
            <button
              type="button"
              className={section === 'model' ? 'is-active' : ''}
              aria-current={section === 'model' ? 'page' : undefined}
              onClick={() => setSection('model')}
            >
              Model
            </button>
            <button
              type="button"
              className={section === 'limits' ? 'is-active' : ''}
              aria-current={section === 'limits' ? 'page' : undefined}
              onClick={() => setSection('limits')}
            >
              Scope & limits
            </button>
            <button
              type="button"
              className={section === 'sources' ? 'is-active' : ''}
              aria-current={section === 'sources' ? 'page' : undefined}
              onClick={() => setSection('sources')}
            >
              Sources
            </button>
          </nav>
          <div className="methodology-content">
            {section === 'model' && (
              <>
                <h3>What the simulation represents</h3>
                <p>
                  A client-side stochastic discrete-event simulation models arrivals, a strict
                  acuity-priority queue, treatment-space use, treatment completion, admission, and
                  boarding. It represents the input–throughput–output structure of crowding; it does
                  not represent clinical care pathways.
                </p>
                <div className="method-steps">
                  <article>
                    <span>01</span>
                    <h4>Warm up</h4>
                    <p>
                      Run 24 hours without reporting to reduce empty-system initialization bias.
                    </p>
                  </article>
                  <article>
                    <span>02</span>
                    <h4>Observe</h4>
                    <p>Report the following 24 hours in exact time-weighted 15-minute bins.</p>
                  </article>
                  <article>
                    <span>03</span>
                    <h4>Repeat</h4>
                    <p>Aggregate per-replication metrics as median and 10th–90th percentiles.</p>
                  </article>
                </div>
                <h3>Event and resource logic</h3>
                <ul>
                  <li>Hourly Poisson arrival counts receive random within-hour timestamps.</li>
                  <li>
                    High, then moderate, then low acuity receive main-space priority; FIFO applies
                    within tiers.
                  </li>
                  <li>Low-acuity fast track uses spaces reallocated from the configured total.</li>
                  <li>Admitted patients retain the same treatment space throughout boarding.</li>
                  <li>
                    Simultaneous completions release capacity before arrivals and deterministic
                    dispatch.
                  </li>
                </ul>
                <h3>Analysis-window cohorts</h3>
                <p>
                  Wait metrics use patients whose treatment starts in the analysis window; length of
                  stay uses patients whose departure occurs in that window; arrival and departure
                  counts use their respective events. These complete-event cohorts can include a
                  warm-up arrival and exclude a patient still unfinished at 24 hours, so end-state
                  measures report unfinished workload separately. Undefined replication values are
                  excluded; exports report the valid replication count, and a metric with no
                  eligible observations is shown as N/A.
                </p>
                <h3>Randomness and distributions</h3>
                <p>
                  Treatment and boarding durations use bounded lognormal distributions. A fixed
                  seeded 32-bit generator and child streams make runs reproducible. Scenario A and B
                  share the master seed; aligned streams reduce comparison noise when demand
                  matches.
                </p>
                <h3>Active 24-hour arrival profile</h3>
                <p>
                  These normalized multipliers have a daily mean of 1.000. Scenario JSON export
                  includes this complete derived vector for both scenarios.
                </p>
                <ol className="hourly-profile-list" aria-label="Normalized hourly multipliers">
                  {hourlyProfile.map((value, hour) => (
                    <li key={hour}>
                      <span>{String(hour).padStart(2, '0')}:00</span>
                      <strong>{value.toFixed(3)}</strong>
                    </li>
                  ))}
                </ol>
                <p className="method-link-copy">
                  The complete mathematical contract is in <code>docs/MODEL.md</code>.
                </p>
              </>
            )}
            {section === 'limits' && (
              <>
                <h3>Deliberately simplified</h3>
                <p>
                  Treatment duration is a composite operational interval. The model does not
                  separately simulate clinicians, diagnostics, resuscitation resources, inpatient
                  beds, transport, environmental services, observation, reassessment, deterioration,
                  specialty placement, or hospital discharge processes.
                </p>
                <div className="notice notice--amber">
                  <strong>Not a validated forecasting model.</strong> Defaults are synthetic,
                  illustrative assumptions—not hospital benchmarks. Results are conditional on the
                  values selected and do not establish intervention effectiveness.
                </div>
                <h3>Appropriate use</h3>
                <p>
                  Use the sandbox to learn systems thinking, inspect model behavior, and generate
                  hypotheses. Do not use it for staffing, clinical, regulatory, or real operational
                  decisions.
                </p>
                <h3>Known structural effects</h3>
                <ul>
                  <li>
                    A fixed 24-hour warm-up reduces empty-start bias but may be inadequate under
                    severe overload or very long carryover.
                  </li>
                  <li>Strict priority can produce long low-acuity waits under overload.</li>
                  <li>
                    One-at-a-time sensitivity analysis cannot reveal multi-parameter interactions.
                  </li>
                  <li>
                    Aggregate boarding duration does not reveal the cause of an output constraint.
                  </li>
                  <li>
                    Monte Carlo uncertainty is simulation variation, not real-world predictive
                    uncertainty.
                  </li>
                </ul>
              </>
            )}
            {section === 'sources' && (
              <>
                <h3>Conceptual and methodological sources</h3>
                <ol className="bibliography">
                  <li>
                    <a
                      href={
                        sourceMapUrl
                          ? `${sourceMapUrl}#s1-asplin-et-al-2003`
                          : 'https://doi.org/10.1067/mem.2003.302'
                      }
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Source S1 full citation"
                    >
                      <strong>[S1]</strong>
                    </a>{' '}
                    Asplin BR, Magid DJ, Rhodes KV, Solberg LI, Lurie N, Camargo CA Jr. A conceptual
                    model of emergency department crowding. <em>Annals of Emergency Medicine</em>.
                    2003;42(2):173–180.{' '}
                    <a href="https://doi.org/10.1067/mem.2003.302" target="_blank" rel="noreferrer">
                      doi:10.1067/mem.2003.302
                    </a>
                  </li>
                  <li>
                    <a
                      href={
                        sourceMapUrl
                          ? `${sourceMapUrl}#s2-hoot-et-al-2008`
                          : 'https://doi.org/10.1016/j.annemergmed.2007.12.011'
                      }
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Source S2 full citation"
                    >
                      <strong>[S2]</strong>
                    </a>{' '}
                    Hoot NR, LeBlanc LJ, Jones I, et al. Forecasting emergency department crowding:
                    a discrete event simulation. <em>Annals of Emergency Medicine</em>.
                    2008;52(2):116–125.{' '}
                    <a
                      href="https://doi.org/10.1016/j.annemergmed.2007.12.011"
                      target="_blank"
                      rel="noreferrer"
                    >
                      doi:10.1016/j.annemergmed.2007.12.011
                    </a>
                  </li>
                  <li>
                    <a
                      href={
                        sourceMapUrl
                          ? `${sourceMapUrl}#s3-bair-et-al-2010`
                          : 'https://doi.org/10.1007/s10916-009-9307-4'
                      }
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Source S3 full citation"
                    >
                      <strong>[S3]</strong>
                    </a>{' '}
                    Bair AE, Song WT, Chen YC, Morris BA. The impact of inpatient boarding on ED
                    efficiency: a discrete-event simulation study.{' '}
                    <em>Journal of Medical Systems</em>. 2010;34(5):919–929.{' '}
                    <a
                      href="https://doi.org/10.1007/s10916-009-9307-4"
                      target="_blank"
                      rel="noreferrer"
                    >
                      doi:10.1007/s10916-009-9307-4
                    </a>
                  </li>
                </ol>
                <p>
                  Sources support the conceptual structure and simulation method—not the numerical
                  defaults. Full claim mapping, verified identifiers, and additional methodology
                  sources are in{' '}
                  {sourceMapUrl ? (
                    <a href={sourceMapUrl} target="_blank" rel="noreferrer">
                      docs/SOURCES.md
                    </a>
                  ) : (
                    <code>docs/SOURCES.md</code>
                  )}
                  .
                </p>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
