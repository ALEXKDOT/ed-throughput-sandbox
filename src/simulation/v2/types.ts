export const ESI_LEVELS = [1, 2, 3, 4, 5] as const;
export type EsiLevel = (typeof ESI_LEVELS)[number];

export type ArrivalMode = 'walkIn' | 'ambulance';
export type PathwayKind = 'minorInjury' | 'medical' | 'abdominal' | 'behavioralHealth';
export type Disposition = 'discharge' | 'admit' | 'transfer' | 'lwbs' | 'lbtc' | 'elope' | 'death';

export type LocationKind =
  | 'walkInEntrance'
  | 'ambulanceArrival'
  | 'triage'
  | 'waiting'
  | 'overflowWaiting'
  | 'mainTreatment'
  | 'fastTrack'
  | 'hallway'
  | 'trauma'
  | 'observation'
  | 'behavioralHealth'
  | 'ct'
  | 'mri'
  | 'xray'
  | 'ultrasound'
  | 'laboratory'
  | 'dischargeLounge'
  | 'boarding'
  | 'inpatientDestination'
  | 'exit';

export type ResourceKind =
  | 'triageSpot'
  | 'mainRoom'
  | 'fastTrackSpace'
  | 'hallwayBed'
  | 'traumaBay'
  | 'observationBed'
  | 'behavioralHealthBed'
  | 'ctScanner'
  | 'mriScanner'
  | 'xrayRoom'
  | 'ultrasoundRoom'
  | 'labProcessor'
  | 'dischargeSeat'
  | 'boardingBed';

export type ServiceKind =
  | 'triage'
  | 'initialTreatment'
  | 'ct'
  | 'mri'
  | 'xray'
  | 'ultrasound'
  | 'lab'
  | 'reassessment'
  | 'dischargeLounge'
  | 'boarding';

export type PatientStatus =
  | 'awaitingTriage'
  | 'awaitingRoom'
  | 'awaitingClinician'
  | 'awaitingOrders'
  | 'awaitingSpecimenCollection'
  | 'awaitingLabResults'
  | 'awaitingImaging'
  | 'imagingInProgress'
  | 'awaitingReassessment'
  | 'dischargePending'
  | 'admissionDecisionPending'
  | 'admittedAwaitingBed'
  | 'awaitingTransport';

export interface LocationDefinitionV2 {
  id: LocationKind;
  label: string;
  shortLabel: string;
  group: 'input' | 'throughput' | 'diagnostics' | 'output';
  map: { x: number; y: number; width: number; height: number };
}

export type EsiValuesV2 = Record<EsiLevel, number>;

export interface VisualizerCapacitiesV2 {
  triageSpots: number;
  mainRooms: number;
  fastTrackSpaces: number;
  hallwayBeds: number;
  traumaBays: number;
  observationBeds: number;
  behavioralHealthBeds: number;
  ctScanners: number;
  mriScanners: number;
  xrayRooms: number;
  ultrasoundRooms: number;
  labProcessors: number;
  dischargeSeats: number;
  boardingBeds: number;
}

export type CapacityKeyV2 = keyof VisualizerCapacitiesV2;

export interface DemandConfigV2 {
  meanArrivalsPerHour: number;
  hourlyMultipliers: number[];
  esiMix: EsiValuesV2;
  arrivalModeMix: Record<ArrivalMode, number>;
}

export interface DurationConfigV2 {
  triageMedian: number;
  treatmentMedianByEsi: EsiValuesV2;
  reassessmentMedian: number;
  ctMedian: number;
  mriMedian: number;
  xrayMedian: number;
  ultrasoundMedian: number;
  labMedian: number;
  dischargeLoungeMedian: number;
  boardingMedian: number;
  variability: number;
  globalScale: number;
}

export type InterventionActionV2 =
  | { kind: 'addCapacity'; capacity: CapacityKeyV2; count: number }
  | { kind: 'scaleArrivals'; multiplier: number }
  | { kind: 'scaleService'; service: ServiceKind; multiplier: number }
  | { kind: 'scaleBoarding'; multiplier: number };

export interface ScheduledInterventionV2 {
  id: string;
  label: string;
  atMinute: number;
  actions: InterventionActionV2[];
}

export interface ScenarioConfigV2 {
  schemaVersion: 2;
  modelVersion: 'edts-model-v2';
  name: string;
  seed: number;
  replications: number;
  window: {
    warmUpMinutes: number;
    analysisMinutes: number;
  };
  demand: DemandConfigV2;
  capacities: VisualizerCapacitiesV2;
  durations: DurationConfigV2;
  admissionRates: EsiValuesV2;
  interventions: ScheduledInterventionV2[];
}

export interface ResourceUnitV2 {
  id: string;
  kind: ResourceKind;
  locationId: LocationKind;
  label: string;
  ordinal: number;
}

export type ResourceDisplayStateV2 = 'available' | 'occupied' | 'reserved' | 'closed' | 'blocked';

export interface ResourceSnapshotV2 extends ResourceUnitV2 {
  state: ResourceDisplayStateV2;
  patientId?: number;
  queueLength: number;
}

export interface PatientIdentityV2 {
  id: number;
  displayId: string;
  arrivalMinute: number;
  esi: EsiLevel;
  arrivalMode: ArrivalMode;
  pathway: PathwayKind;
}

export interface PatientSnapshotV2 extends PatientIdentityV2 {
  active: boolean;
  locationId: LocationKind;
  statuses: PatientStatus[];
  assignedTreatmentResourceId?: string;
  activeServiceResourceId?: string;
  disposition?: Disposition;
  waitMinutes: number;
  losMinutes: number;
}

export interface LiveKpisV2 {
  census: number;
  waiting: number;
  occupiedTreatment: number;
  treatmentCapacity: number;
  imagingQueue: number;
  boarders: number;
  departures: number;
  medianDoorToRoom: number | null;
}

export interface ReplayStateV2 {
  minute: number;
  patients: Record<string, PatientSnapshotV2>;
  resources: Record<string, ResourceSnapshotV2>;
  live: LiveKpisV2;
}

export type ReplayPatchV2 =
  | { kind: 'upsertPatient'; patient: PatientSnapshotV2 }
  | { kind: 'removePatient'; patientId: number }
  | { kind: 'upsertResource'; resource: ResourceSnapshotV2 };

export type TraceEventKindV2 =
  | 'arrival'
  | 'triageStart'
  | 'triageComplete'
  | 'treatmentStart'
  | 'serviceStart'
  | 'serviceComplete'
  | 'move'
  | 'statusChange'
  | 'boardingStart'
  | 'intervention'
  | 'departure';

export interface TraceDomainEventV2 {
  kind: TraceEventKindV2;
  patientId?: number;
  resourceId?: string;
  fromLocationId?: LocationKind;
  toLocationId?: LocationKind;
  service?: ServiceKind;
  disposition?: Disposition;
  label: string;
}

export interface TraceFrameV2 {
  minute: number;
  sequence: number;
  events: TraceDomainEventV2[];
  patches: ReplayPatchV2[];
  live: LiveKpisV2;
}

export interface ReplayCheckpointV2 {
  minute: number;
  frameIndex: number;
  state: ReplayStateV2;
}

export type VisualizerMetricKeyV2 =
  | 'doorToRoom'
  | 'lengthOfStay'
  | 'boarderHours'
  | 'waitingPatientHours'
  | 'departures'
  | 'peakCensus'
  | 'peakWaiting'
  | 'imagingDelay';

export const VISUALIZER_METRIC_KEYS: readonly VisualizerMetricKeyV2[] = [
  'doorToRoom',
  'lengthOfStay',
  'boarderHours',
  'waitingPatientHours',
  'departures',
  'peakCensus',
  'peakWaiting',
  'imagingDelay',
];

export interface ReplicationMetricsV2 {
  values: Record<VisualizerMetricKeyV2, number | null>;
  arrivals: number;
  departuresByDisposition: Record<Disposition, number>;
}

export interface ReplicationSeriesPointV2 {
  minute: number;
  census: number;
  waiting: number;
  occupiedTreatment: number;
  imagingQueue: number;
  boarders: number;
  departures: number;
}

export interface ReplicationSummaryV2 {
  replication: number;
  metrics: ReplicationMetricsV2;
  series: ReplicationSeriesPointV2[];
  peakMinute: number;
  diagnostics: {
    eventCount: number;
    maxActivePatients: number;
    maxOwnedResources: number;
    conservationValid: boolean;
    resourceOwnershipValid: boolean;
    timestampsNondecreasing: boolean;
  };
  trace?: SimulationTraceV2;
}

export interface IntervalValueV2 {
  median: number | null;
  low: number | null;
  high: number | null;
  n: number;
}

export interface AggregateSeriesPointV2 {
  minute: number;
  census: IntervalValueV2;
  waiting: IntervalValueV2;
  occupiedTreatment: IntervalValueV2;
  imagingQueue: IntervalValueV2;
  boarders: IntervalValueV2;
  departures: IntervalValueV2;
}

export interface AggregateResultV2 {
  scenario: ScenarioConfigV2;
  algorithmVersion: string;
  replicationCount: number;
  metrics: Record<VisualizerMetricKeyV2, IntervalValueV2>;
  series: AggregateSeriesPointV2[];
  elapsedMilliseconds: number;
}

export interface ComparisonResultV2 {
  a: AggregateResultV2;
  b: AggregateResultV2;
  deltas: Record<VisualizerMetricKeyV2, IntervalValueV2>;
  pairing: 'patient' | 'replicationOnly';
  changedAssumptions: string[];
}

export interface RepresentativeSelectionV2 {
  replication: number;
  distance: number;
  algorithmVersion: string;
  pairing: 'patient' | 'replicationOnly';
}

export interface SimulationTraceV2 {
  schemaVersion: 2;
  modelVersion: 'edts-model-v2';
  traceVersion: string;
  scenarioName: string;
  scenarioDigest: string;
  seed: number;
  replication: number;
  window: { startMinute: 0; endMinute: number };
  selection: RepresentativeSelectionV2;
  identities: PatientIdentityV2[];
  initial: ReplayCheckpointV2;
  frames: TraceFrameV2[];
  checkpoints: ReplayCheckpointV2[];
  finalMetrics: ReplicationMetricsV2;
  peakMinute: number;
}

export interface VisualizerRunPayloadV2 {
  results: Partial<Record<'a' | 'b', AggregateResultV2>>;
  comparison?: ComparisonResultV2;
  representative: {
    replication: number;
    pairing: 'patient' | 'replicationOnly';
    traces: Partial<Record<'a' | 'b', SimulationTraceV2>>;
  };
}
