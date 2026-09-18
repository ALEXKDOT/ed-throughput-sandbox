import { useMemo } from 'react';
import { VISUALIZER_LOCATIONS } from '../simulation/v2/defaults';
import type {
  LocationDefinitionV2,
  PatientSnapshotV2,
  ReplayStateV2,
  ResourceSnapshotV2,
} from '../simulation/v2/types';

export type VisualizerSelection =
  | { kind: 'patient'; id: number; slot: 'a' | 'b' }
  | { kind: 'resource'; id: string; slot: 'a' | 'b' }
  | undefined;

interface DepartmentMapProps {
  state?: ReplayStateV2;
  title: string;
  slot: 'a' | 'b';
  selection: VisualizerSelection;
  onSelect: (selection: VisualizerSelection) => void;
  reducedMotion: boolean;
  onFocusPane?: () => void;
}

const GROUP_LABELS = {
  input: 'INPUT',
  throughput: 'CARE SPACES',
  diagnostics: 'DIAGNOSTICS',
  output: 'OUTPUT',
};

function zoneGeometry(location: LocationDefinitionV2) {
  return {
    x: location.map.x * 10,
    y: location.map.y * 6.2,
    width: location.map.width * 10,
    height: location.map.height * 6.2,
  };
}

function resourcePosition(resource: ResourceSnapshotV2, location: LocationDefinitionV2) {
  const geometry = zoneGeometry(location);
  const columns = Math.max(1, Math.floor((geometry.width - 22) / 20));
  return {
    x: geometry.x + 14 + (resource.ordinal % columns) * 20,
    y: geometry.y + 37 + Math.floor(resource.ordinal / columns) * 18,
  };
}

function patientPosition(
  patient: PatientSnapshotV2,
  location: LocationDefinitionV2,
  index: number,
) {
  const geometry = zoneGeometry(location);
  const columns = Math.max(2, Math.floor((geometry.width - 20) / 17));
  const baseY = geometry.y + Math.min(74, Math.max(42, geometry.height * 0.54));
  const row = Math.floor(index / columns);
  const jitter = ((patient.id * 17) % 5) - 2;
  return {
    x: geometry.x + 14 + (index % columns) * 17 + jitter,
    y: Math.min(geometry.y + geometry.height - 11, baseY + row * 17 + jitter / 2),
  };
}

function mapSummary(state?: ReplayStateV2): string {
  if (!state) return 'Department map ready for a representative simulation.';
  return `Department map at minute ${Math.round(state.minute)}. ${state.live.census} active synthetic patients, ${state.live.waiting} waiting, ${state.live.boarders} boarders, and ${state.live.imagingQueue} waiting for diagnostics.`;
}

export function DepartmentMap({
  state,
  title,
  slot,
  selection,
  onSelect,
  reducedMotion,
  onFocusPane,
}: DepartmentMapProps) {
  const resources = useMemo(() => Object.values(state?.resources ?? {}), [state]);
  const patients = useMemo(() => Object.values(state?.patients ?? {}).slice(0, 300), [state]);
  const patientsByLocation = useMemo(() => {
    const values = new Map<string, PatientSnapshotV2[]>();
    for (const patient of patients) {
      const group = values.get(patient.locationId) ?? [];
      group.push(patient);
      values.set(patient.locationId, group);
    }
    for (const group of values.values()) group.sort((a, b) => a.id - b.id);
    return values;
  }, [patients]);

  return (
    <section className={`department-pane department-pane--${slot}`} onPointerDown={onFocusPane}>
      <div className="department-pane-heading">
        <div>
          <span>Scenario {slot.toUpperCase()}</span>
          <strong>{title}</strong>
        </div>
        <small>{state ? `${state.live.census} in ED` : 'Not run'}</small>
      </div>
      <svg
        className={`department-map${reducedMotion ? ' is-reduced-motion' : ''}`}
        viewBox="0 0 1000 620"
        role="img"
        aria-label={mapSummary(state)}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <pattern id={`reserved-hatch-${slot}`} width="6" height="6" patternUnits="userSpaceOnUse">
            <path d="M-1 1L1-1M0 6L6 0M5 7L7 5" stroke="#466473" strokeWidth="1.5" />
          </pattern>
          <pattern id={`closed-hatch-${slot}`} width="7" height="7" patternUnits="userSpaceOnUse">
            <path d="M0 0L7 7M7 0L0 7" stroke="#8b4b47" strokeWidth="1" />
          </pattern>
          <filter id={`selected-glow-${slot}`} x="-100%" y="-100%" width="300%" height="300%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#0b6bcb" />
          </filter>
        </defs>
        <rect className="map-canvas" x="0" y="0" width="1000" height="620" rx="10" />
        <path className="map-route" d="M150 130H190M360 130H400M740 230H780M740 450H780" />
        {VISUALIZER_LOCATIONS.map((location) => {
          const geometry = zoneGeometry(location);
          const zoneResources = resources.filter((resource) => resource.locationId === location.id);
          const zonePatients = patientsByLocation.get(location.id) ?? [];
          return (
            <g key={location.id} className={`map-zone-svg map-zone-svg--${location.group}`}>
              <rect {...geometry} rx="7" />
              <text x={geometry.x + 10} y={geometry.y + 18} className="map-zone-name">
                {location.shortLabel}
              </text>
              <text
                x={geometry.x + geometry.width - 9}
                y={geometry.y + 18}
                className="map-zone-count"
              >
                {zonePatients.length > 0 ? `${zonePatients.length} patients` : ''}
              </text>
              <text
                x={geometry.x + 10}
                y={geometry.y + geometry.height - 8}
                className="map-zone-group"
              >
                {GROUP_LABELS[location.group]}
              </text>
              {zoneResources.map((resource) => {
                const point = resourcePosition(resource, location);
                const selected =
                  selection?.kind === 'resource' &&
                  selection.slot === slot &&
                  selection.id === resource.id;
                const fill =
                  resource.state === 'reserved'
                    ? `url(#reserved-hatch-${slot})`
                    : resource.state === 'closed' || resource.state === 'blocked'
                      ? `url(#closed-hatch-${slot})`
                      : undefined;
                return (
                  <g
                    key={resource.id}
                    className={`resource-glyph resource-glyph--${resource.state}${selected ? ' is-selected' : ''}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect({ kind: 'resource', id: resource.id, slot });
                    }}
                    aria-hidden="true"
                  >
                    <rect
                      x={point.x - 5}
                      y={point.y - 5}
                      width="11"
                      height="11"
                      rx="2"
                      fill={fill}
                    />
                    {resource.state === 'available' && (
                      <circle cx={point.x + 0.5} cy={point.y + 0.5} r="1.5" />
                    )}
                    {selected && (
                      <rect
                        className="resource-selection"
                        x={point.x - 8}
                        y={point.y - 8}
                        width="17"
                        height="17"
                        rx="4"
                      />
                    )}
                    <title>{`${resource.label}: ${resource.state}`}</title>
                  </g>
                );
              })}
              {zonePatients.map((patient, index) => {
                const point = patientPosition(patient, location, index);
                const selected =
                  selection?.kind === 'patient' &&
                  selection.slot === slot &&
                  selection.id === patient.id;
                const boarding = patient.statuses.includes('admittedAwaitingBed');
                return (
                  <g
                    key={patient.id}
                    className={`patient-glyph${selected ? ' is-selected' : ''}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect({ kind: 'patient', id: patient.id, slot });
                    }}
                    aria-hidden="true"
                  >
                    {boarding && (
                      <circle className="patient-boarder-ring" cx={point.x} cy={point.y} r="7.2" />
                    )}
                    <circle
                      className={`patient-dot patient-dot--esi-${patient.esi}`}
                      cx={point.x}
                      cy={point.y}
                      r={selected ? 5.8 : 4.5}
                      filter={selected ? `url(#selected-glow-${slot})` : undefined}
                    />
                    {selected && (
                      <circle
                        className="patient-selection-ring"
                        cx={point.x}
                        cy={point.y}
                        r="9.5"
                      />
                    )}
                    <title>{`${patient.displayId}, ESI ${patient.esi}, ${location.label}`}</title>
                  </g>
                );
              })}
            </g>
          );
        })}
        <g className="map-zone-svg map-zone-svg--locked">
          <rect x="20" y="480" width="320" height="78" rx="7" />
          <text x="34" y="507" className="map-zone-name">
            Inpatient destinations
          </text>
          <text x="34" y="531" className="map-locked-copy">
            Aggregate delay only · unit-level model deferred
          </text>
          <text x="326" y="507" textAnchor="end" className="map-lock-label">
            LOCKED
          </text>
        </g>
      </svg>
      {!state && (
        <div className="department-map-empty">
          <span aria-hidden="true" />
          <strong>Ready for a representative week</strong>
          <small>Run this scenario to populate its resources and synthetic patients.</small>
        </div>
      )}
    </section>
  );
}
