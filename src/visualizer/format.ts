import { VISUALIZER_LOCATIONS } from '../simulation/v2/defaults';
import type {
  LocationKind,
  PatientStatus,
  ResourceDisplayStateV2,
  VisualizerMetricKeyV2,
} from '../simulation/v2/types';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function formatSimulationTime(minute: number, horizonMinute?: number) {
  const safe = Math.max(0, Math.floor(minute));
  const complete = horizonMinute != null && horizonMinute > 0 && minute >= horizonMinute;
  const displayMinute = complete ? Math.max(0, Math.floor(horizonMinute) - 1) : safe;
  const absoluteDayIndex = Math.floor(displayMinute / 1_440);
  const dayIndex = absoluteDayIndex % 7;
  const minuteOfDay = displayMinute % 1_440;
  const hour = Math.floor(minuteOfDay / 60);
  const minutes = minuteOfDay % 60;
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return {
    day: DAYS[dayIndex]!,
    dayShort: DAYS[dayIndex]!.slice(0, 3),
    dayNumber: absoluteDayIndex + 1,
    clock: complete ? 'Complete' : `${displayHour}:${String(minutes).padStart(2, '0')} ${period}`,
    compact: complete
      ? `${DAYS[dayIndex]!.slice(0, 3)} · simulation complete`
      : `${DAYS[dayIndex]!.slice(0, 3)} ${displayHour}:${String(minutes).padStart(2, '0')} ${period}`,
    complete,
  };
}

export function formatDurationV2(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return 'N/A';
  if (value >= 120) return `${(value / 60).toFixed(value >= 600 ? 0 : 1)} hr`;
  return `${Math.round(value)} min`;
}

export function formatMetricV2(metric: VisualizerMetricKeyV2, value: number | null): string {
  if (value == null || !Number.isFinite(value)) return 'N/A';
  if (metric === 'doorToRoom' || metric === 'lengthOfStay' || metric === 'imagingDelay') {
    return formatDurationV2(value);
  }
  if (metric === 'boarderHours' || metric === 'overflowPatientHours') {
    return `${value.toFixed(value >= 100 ? 0 : 1)} hr`;
  }
  return Math.round(value).toLocaleString();
}

export function locationLabel(locationId: LocationKind): string {
  if (locationId === 'exit') return 'Departed';
  if (locationId === 'inpatientDestination') return 'Inpatient destination';
  return VISUALIZER_LOCATIONS.find((location) => location.id === locationId)?.label ?? locationId;
}

export const STATUS_LABELS: Record<PatientStatus, string> = {
  awaitingTriage: 'Awaiting triage',
  awaitingRoom: 'Awaiting treatment space',
  awaitingClinician: 'Awaiting clinician',
  awaitingOrders: 'Awaiting orders',
  awaitingSpecimenCollection: 'Awaiting specimen collection',
  awaitingLabResults: 'Awaiting lab results',
  awaitingImaging: 'Awaiting imaging',
  imagingInProgress: 'Imaging in progress',
  awaitingReassessment: 'Awaiting reassessment',
  dischargePending: 'Discharge pending',
  admissionDecisionPending: 'Admission decision pending',
  admittedAwaitingBed: 'Admitted, awaiting inpatient bed',
  awaitingTransport: 'Awaiting transport',
};

export const RESOURCE_STATE_LABELS: Record<ResourceDisplayStateV2, string> = {
  available: 'Available',
  occupied: 'Occupied',
  reserved: 'Reserved',
  closed: 'Closed',
  blocked: 'Blocked',
};

export const METRIC_LABELS_V2: Record<VisualizerMetricKeyV2, string> = {
  doorToRoom: 'Door to treatment space',
  lengthOfStay: 'ED length of stay',
  boarderHours: 'Boarding hours',
  overflowPatientHours: 'Overflow patient-hours',
  departures: 'Departures',
  peakCensus: 'Peak ED census',
  peakWaiting: 'Peak waiting',
  imagingDelay: 'Diagnostic queue delay',
};
