import { useEffect, useMemo, useState } from 'react';
import type {
  PatientSnapshotV2,
  ReplayStateV2,
  ResourceSnapshotV2,
  SimulationTraceV2,
} from '../simulation/v2/types';
import {
  formatDurationV2,
  formatSimulationTime,
  locationLabel,
  RESOURCE_STATE_LABELS,
  STATUS_LABELS,
} from './format';
import type { VisualizerSelection } from './DepartmentMap';

interface InspectorPanelProps {
  state?: ReplayStateV2;
  trace?: SimulationTraceV2;
  selection: VisualizerSelection;
  onSelect: (selection: VisualizerSelection) => void;
  scenarioLabel: string;
  slot: 'a' | 'b';
}

function PatientDetails({
  patient,
  trace,
  minute,
}: {
  patient: PatientSnapshotV2;
  trace?: SimulationTraceV2;
  minute: number;
}) {
  const journey = useMemo(
    () =>
      (trace?.frames ?? [])
        .filter((frame) => frame.minute <= minute)
        .flatMap((frame) =>
          frame.events
            .filter((event) => event.patientId === patient.id && event.kind !== 'statusChange')
            .map((event) => ({ minute: frame.minute, event })),
        )
        .slice(-10)
        .reverse(),
    [minute, patient.id, trace],
  );
  return (
    <article className="entity-details">
      <div className="entity-title-row">
        <span className={`census-esi census-esi--${patient.esi}`}>ESI {patient.esi}</span>
        <div>
          <h3>{patient.displayId}</h3>
          <span>{patient.arrivalMode === 'walkIn' ? 'Walk-in arrival' : 'Ambulance arrival'}</span>
        </div>
      </div>
      <dl className="entity-facts">
        <div>
          <dt>Physical location</dt>
          <dd>{locationLabel(patient.locationId)}</dd>
        </div>
        <div>
          <dt>Pathway</dt>
          <dd>{patient.pathway.replaceAll(/([A-Z])/gu, ' $1').toLowerCase()}</dd>
        </div>
        <div>
          <dt>Door to room</dt>
          <dd>{formatDurationV2(patient.waitMinutes)}</dd>
        </div>
        <div>
          <dt>Time in ED</dt>
          <dd>{formatDurationV2(patient.losMinutes)}</dd>
        </div>
      </dl>
      <div className="status-section">
        <strong>Concurrent statuses</strong>
        <div className="status-chip-list">
          {patient.statuses.length > 0 ? (
            patient.statuses.map((status) => <span key={status}>{STATUS_LABELS[status]}</span>)
          ) : (
            <span>Service in progress</span>
          )}
        </div>
      </div>
      <div className="journey-section">
        <strong>Journey to this point</strong>
        {journey.length > 0 ? (
          <ol>
            {journey.map(({ minute: eventMinute, event }, index) => (
              <li key={`${eventMinute}-${event.kind}-${index}`}>
                <time>{formatSimulationTime(eventMinute, trace?.window.endMinute).compact}</time>
                <span>{event.label}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p>No visible-week journey events yet.</p>
        )}
      </div>
    </article>
  );
}

function ResourceDetails({
  resource,
  state,
}: {
  resource: ResourceSnapshotV2;
  state: ReplayStateV2;
}) {
  const occupant =
    resource.patientId == null ? undefined : state.patients[String(resource.patientId)];
  return (
    <article className="entity-details">
      <div className="entity-title-row resource-title-row">
        <span
          className={`resource-state-mark resource-state-mark--${resource.state}`}
          aria-hidden="true"
        />
        <div>
          <h3>{resource.label}</h3>
          <span>{RESOURCE_STATE_LABELS[resource.state]}</span>
        </div>
      </div>
      <dl className="entity-facts">
        <div>
          <dt>Location</dt>
          <dd>{locationLabel(resource.locationId)}</dd>
        </div>
        <div>
          <dt>Queue</dt>
          <dd>{resource.queueLength} waiting</dd>
        </div>
        <div>
          <dt>Current owner</dt>
          <dd>{occupant?.displayId ?? 'None'}</dd>
        </div>
        <div>
          <dt>Ownership</dt>
          <dd>
            {resource.state === 'reserved'
              ? 'Held during diagnostic travel'
              : RESOURCE_STATE_LABELS[resource.state]}
          </dd>
        </div>
      </dl>
      <p className="resource-note">
        Resources are modeled individually. “Reserved” means the patient is physically elsewhere but
        this space cannot be assigned to another patient.
      </p>
    </article>
  );
}

export function InspectorPanel({
  state,
  trace,
  selection,
  onSelect,
  scenarioLabel,
  slot,
}: InspectorPanelProps) {
  const [tab, setTab] = useState<'patients' | 'resources'>('patients');
  const [query, setQuery] = useState('');
  const normalized = query.trim().toLowerCase();
  const patients = useMemo(
    () =>
      Object.values(state?.patients ?? {})
        .filter((patient) => {
          const search =
            `${patient.displayId} esi ${patient.esi} ${patient.locationId} ${patient.statuses.join(' ')}`.toLowerCase();
          return search.includes(normalized);
        })
        .sort((a, b) => b.waitMinutes - a.waitMinutes || a.esi - b.esi || a.id - b.id),
    [normalized, state],
  );
  const resources = useMemo(
    () =>
      Object.values(state?.resources ?? {})
        .filter((resource) =>
          `${resource.label} ${resource.locationId} ${resource.state}`
            .toLowerCase()
            .includes(normalized),
        )
        .sort((a, b) => a.locationId.localeCompare(b.locationId) || a.ordinal - b.ordinal),
    [normalized, state],
  );
  const selectedPatient =
    selection?.kind === 'patient' && selection.slot === slot
      ? state?.patients[String(selection.id)]
      : undefined;
  const selectedResource =
    selection?.kind === 'resource' && selection.slot === slot
      ? state?.resources[selection.id]
      : undefined;

  useEffect(() => {
    if (selection?.slot !== slot) return;
    if (selection.kind === 'patient') setTab('patients');
    if (selection.kind === 'resource') setTab('resources');
  }, [selection, slot]);

  return (
    <aside className="visualizer-inspector" aria-labelledby="inspector-title">
      <div className="panel-heading-row">
        <div>
          <span className="section-kicker">Inspect · {scenarioLabel}</span>
          <h2 id="inspector-title">Census & resources</h2>
        </div>
        <span className="configuration-state">{state?.live.census ?? 0} active</span>
      </div>
      <div className="inspector-tabs" role="tablist" aria-label="Inspector views">
        <button
          role="tab"
          aria-selected={tab === 'patients'}
          type="button"
          onClick={() => setTab('patients')}
        >
          Patients
        </button>
        <button
          role="tab"
          aria-selected={tab === 'resources'}
          type="button"
          onClick={() => setTab('resources')}
        >
          Resources
        </button>
      </div>
      {state && (
        <label className="search-field">
          <span className="sr-only">Filter synthetic census or resources</span>
          <input
            type="search"
            placeholder={
              tab === 'patients' ? 'Filter ID, ESI, status…' : 'Filter resource or state…'
            }
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      )}

      {selectedPatient && state ? (
        <>
          <button className="inspector-back" type="button" onClick={() => onSelect(undefined)}>
            ← Back to census
          </button>
          <PatientDetails patient={selectedPatient} trace={trace} minute={state.minute} />
        </>
      ) : selectedResource && state ? (
        <>
          <button className="inspector-back" type="button" onClick={() => onSelect(undefined)}>
            ← Back to resources
          </button>
          <ResourceDetails resource={selectedResource} state={state} />
        </>
      ) : !state ? (
        <div className="inspector-empty">
          <strong>Run, then select an entity</strong>
          <p>
            The inspector will separate physical location, concurrent statuses, waits, and journey
            history.
          </p>
        </div>
      ) : tab === 'patients' ? (
        <div className="census-list" role="list" aria-label="Active synthetic patients">
          {patients.slice(0, 100).map((patient) => (
            <button
              key={patient.id}
              type="button"
              role="listitem"
              className="census-row"
              onClick={() => onSelect({ kind: 'patient', id: patient.id, slot })}
            >
              <span className={`census-esi census-esi--${patient.esi}`}>ESI {patient.esi}</span>
              <span className="census-row-main">
                <strong>{patient.displayId}</strong>
                <small>{locationLabel(patient.locationId)}</small>
              </span>
              <span className="census-wait">{formatDurationV2(patient.waitMinutes)}</span>
            </button>
          ))}
          {patients.length === 0 && (
            <p className="list-empty">No active patients match this filter.</p>
          )}
          {patients.length > 100 && (
            <p className="list-limit">
              Showing 100 of {patients.length}; refine the filter to narrow the census.
            </p>
          )}
        </div>
      ) : (
        <div className="census-list" role="list" aria-label="Modeled resources">
          {resources.map((resource) => (
            <button
              key={resource.id}
              type="button"
              role="listitem"
              className="census-row resource-row"
              onClick={() => onSelect({ kind: 'resource', id: resource.id, slot })}
            >
              <span
                className={`resource-state-mark resource-state-mark--${resource.state}`}
                aria-hidden="true"
              />
              <span className="census-row-main">
                <strong>{resource.label}</strong>
                <small>{locationLabel(resource.locationId)}</small>
              </span>
              <span className="resource-state-label">{RESOURCE_STATE_LABELS[resource.state]}</span>
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}
