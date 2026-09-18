import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { VISUALIZER_LOCATIONS } from '../simulation/v2/defaults';
import type { PatientSnapshotV2, ReplayStateV2 } from '../simulation/v2/types';
import { DepartmentMap } from '../visualizer/DepartmentMap';
import { InspectorPanel } from '../visualizer/InspectorPanel';
import { VisualizerApp } from '../visualizer/VisualizerApp';
import {
  displayLocationForPatient,
  layoutZoneEntities,
  zoneGeometry,
} from '../visualizer/mapLayout';
import { rebalanceEsiMix } from '../visualizer/scenarioEditing';

function syntheticPatient(
  id: number,
  overrides: Partial<PatientSnapshotV2> = {},
): PatientSnapshotV2 {
  return {
    id,
    displayId: `P${String(id + 1).padStart(4, '0')}`,
    arrivalMinute: 0,
    esi: 3,
    arrivalMode: 'walkIn',
    pathway: 'medical',
    active: true,
    locationId: 'waiting',
    statuses: ['awaitingRoom'],
    waitMinutes: 0,
    losMinutes: 0,
    ...overrides,
  };
}

describe('Visualizer workspace', () => {
  it('presents transparent model boundaries and five-level ESI encoding', () => {
    render(<VisualizerApp onOpenSandbox={vi.fn()} />);
    expect(screen.getByText(/Staffing and cost are deliberately omitted/u)).not.toBeVisible();
    expect(screen.getByText('Inpatient destinations')).toBeInTheDocument();
    expect(screen.getAllByText('ESI 1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ESI 5').length).toBeGreaterThan(0);
    expect(screen.getByText(/Run the simulation to choose/u)).toBeVisible();
  });

  it('creates an editable intervention from the baseline', async () => {
    const user = userEvent.setup();
    render(<VisualizerApp onOpenSandbox={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Copy A into intervention B' }));
    expect(screen.getByRole('button', { name: 'Run Scenario B' })).toBeVisible();
    const rooms = screen.getByLabelText('Main treatment rooms, numeric value');
    await user.clear(rooms);
    await user.type(rooms, '22');
    expect(rooms).toHaveValue(22);
  });

  it('exposes ESI, stage-time, pathway, admission, and diagnostic assumptions', async () => {
    const user = userEvent.setup();
    render(<VisualizerApp onOpenSandbox={vi.fn()} />);
    await user.click(screen.getByText('Advanced clinical-flow assumptions'));

    expect(screen.getByLabelText('ESI 3 share, percent')).toHaveValue(43);
    expect(screen.getByLabelText('ESI 3 initial treatment median, minutes')).toHaveValue(125);
    expect(screen.getByLabelText('ESI 3 admission probability, percent')).toHaveValue(22);
    expect(screen.getByLabelText('Abdominal care-time multiplier')).toHaveValue(1);
    expect(screen.getByLabelText('Lab median, minutes')).toHaveValue(48);
    expect(screen.getByLabelText('Abdominal CT order, percent')).toHaveValue(46);
    expect(screen.getByText('Balanced')).toBeVisible();
  });

  it('rebalances ESI shares without changing their total', () => {
    const changed = rebalanceEsiMix({ 1: 0.03, 2: 0.16, 3: 0.43, 4: 0.3, 5: 0.08 }, 3, 50);
    expect(changed[3]).toBe(0.5);
    expect(Object.values(changed).reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 12);
  });

  it('offers a persistent reduced-motion control', async () => {
    const user = userEvent.setup();
    const { container } = render(<VisualizerApp onOpenSandbox={vi.fn()} />);
    await user.selectOptions(screen.getByLabelText('Motion'), 'reduced');
    expect(container.querySelector('.visualizer-reduced-motion')).toBeInTheDocument();
  });

  it('renders every waiting patient without a 300-patient display cap', () => {
    const patients = Object.fromEntries(
      Array.from({ length: 350 }, (_, id) => [String(id), syntheticPatient(id)]),
    );
    const state: ReplayStateV2 = {
      minute: 720,
      patients,
      resources: {},
      live: {
        census: 350,
        waiting: 350,
        occupiedTreatment: 0,
        treatmentCapacity: 0,
        imagingQueue: 0,
        boarders: 0,
        departures: 0,
        medianDoorToRoom: null,
      },
    };
    const { container } = render(
      <DepartmentMap
        state={state}
        title="Overloaded ED"
        slot="a"
        selection={undefined}
        onSelect={vi.fn()}
        reducedMotion
      />,
    );

    expect(container.querySelectorAll('.patient-dot')).toHaveLength(350);
    expect(screen.getByText('350 patients')).toBeInTheDocument();

    const inspector = render(
      <InspectorPanel
        state={state}
        selection={undefined}
        onSelect={vi.fn()}
        scenarioLabel="A"
        slot="a"
      />,
    );
    expect(inspector.container.querySelectorAll('.census-row')).toHaveLength(350);
  });

  it('uses aligned adaptive grids with separate resource and patient bands', () => {
    const waiting = VISUALIZER_LOCATIONS.find((location) => location.id === 'waiting')!;
    const waitingLayout = layoutZoneEntities(zoneGeometry(waiting), 0, 100);
    const coordinates = new Set(
      waitingLayout.patients.map((point) => `${point.x.toFixed(5)},${point.y.toFixed(5)}`),
    );
    expect(coordinates.size).toBe(100);
    expect(new Set(waitingLayout.patients.map((point) => point.x)).size).toBeLessThan(100);
    expect(new Set(waitingLayout.patients.map((point) => point.y)).size).toBeLessThan(100);
    for (const point of waitingLayout.patients) {
      expect(point.x - point.radius).toBeGreaterThanOrEqual(waitingLayout.patientBounds.x);
      expect(point.x + point.radius).toBeLessThanOrEqual(
        waitingLayout.patientBounds.x + waitingLayout.patientBounds.width,
      );
      expect(point.y - point.radius).toBeGreaterThanOrEqual(waitingLayout.patientBounds.y);
      expect(point.y + point.radius).toBeLessThanOrEqual(
        waitingLayout.patientBounds.y + waitingLayout.patientBounds.height,
      );
    }

    const boarding = VISUALIZER_LOCATIONS.find((location) => location.id === 'boarding')!;
    const boardingLayout = layoutZoneEntities(zoneGeometry(boarding), 8, 100);
    const lastResourceEdge = Math.max(
      ...boardingLayout.resources.map((point) => point.y + point.radius),
    );
    const firstPatientEdge = Math.min(
      ...boardingLayout.patients.map((point) => point.y - point.radius),
    );
    expect(lastResourceEdge).toBeLessThan(firstPatientEdge);
  });

  it('groups the full waiting and boarding census without changing modeled locations', () => {
    const preTriage = syntheticPatient(1, {
      locationId: 'walkInEntrance',
      statuses: ['awaitingTriage'],
    });
    const legacyOverflow = syntheticPatient(2, { locationId: 'overflowWaiting' });
    const roomBoarder = syntheticPatient(3, {
      locationId: 'mainTreatment',
      statuses: ['admittedAwaitingBed'],
      assignedTreatmentResourceId: 'R-01',
    });

    expect(displayLocationForPatient(preTriage)).toBe('waiting');
    expect(displayLocationForPatient(legacyOverflow)).toBe('waiting');
    expect(displayLocationForPatient(roomBoarder)).toBe('boarding');
    expect(roomBoarder.locationId).toBe('mainTreatment');
  });
});
