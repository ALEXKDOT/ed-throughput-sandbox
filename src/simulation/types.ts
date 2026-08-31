export const TIERS = ['high', 'moderate', 'low'] as const;
export type AcuityTier = (typeof TIERS)[number];

export type ArrivalProfileName = 'flat' | 'daytime' | 'evening' | 'overnight' | 'custom';
export type VariabilityPreset = 'low' | 'moderate' | 'high';
export type SpaceType = 'main' | 'fastTrack';

export interface TierValues {
  high: number;
  moderate: number;
  low: number;
}

export interface FastTrackConfig {
  enabled: boolean;
  spaces: number;
  medianMinutes: number;
}

export interface ScenarioConfig {
  schemaVersion: 1;
  name: string;
  arrivalRate: number;
  arrivalProfile: ArrivalProfileName;
  customArrivalBlocks: [number, number, number, number, number, number];
  acuityMix: TierValues;
  totalSpaces: number;
  treatmentMedians: TierValues;
  treatmentTimeScale: number;
  treatmentVariability: VariabilityPreset;
  admissionRates: TierValues;
  boardingMedianMinutes: number;
  fastTrack: FastTrackConfig;
  replications: number;
  seed: number;
}

export interface ScenarioBundle {
  schemaVersion: 1;
  exportedAt?: string;
  scenarios: {
    a: ScenarioConfig;
    b: ScenarioConfig;
  };
  activeScenario: 'a' | 'b';
}

export interface PatientRecord {
  id: number;
  arrivalTime: number;
  acuity: AcuityTier;
  queueEntryTime: number;
  treatmentStartTime?: number;
  spaceType?: SpaceType;
  treatmentCompletionTime?: number;
  admitted?: boolean;
  boardingCompletionTime?: number;
  departureTime?: number;
  serviceUniform: number;
  admissionUniform: number;
  boardingUniform: number;
}

export type MetricKey =
  | 'arrivals'
  | 'departures'
  | 'waitingEnd'
  | 'occupiedEnd'
  | 'medianWait'
  | 'p90Wait'
  | 'medianLos'
  | 'dischargedLos'
  | 'admittedLos'
  | 'averageOccupied'
  | 'peakOccupied'
  | 'highOccupancyTime'
  | 'peakQueue'
  | 'boarderHours'
  | 'remainingInSystem';

export interface StatusPoint {
  minute: number;
  occupied: number;
  mainOccupied: number;
  fastTrackOccupied: number;
  waiting: number;
  boarders: number;
}

export interface FlowPoint {
  hour: number;
  arrivals: number;
  departures: number;
}

export interface Flow15Point {
  minute: number;
  arrivals: number;
  departures: number;
}

export interface TierWaitResult {
  median: number | null;
  p90: number | null;
}

export interface ReplicationDiagnostics {
  maxMainOccupied: number;
  maxFastTrackOccupied: number;
  timestampsNondecreasing: boolean;
  patientTimelinesValid: boolean;
  eventCount: number;
}

export interface ReplicationResult {
  replication: number;
  metrics: Record<MetricKey, number | null>;
  tierWaits: Record<AcuityTier, TierWaitResult>;
  status: StatusPoint[];
  flow: FlowPoint[];
  flow15: Flow15Point[];
  diagnostics: ReplicationDiagnostics;
  patients?: PatientRecord[];
}

export interface IntervalValue {
  median: number | null;
  low: number | null;
  high: number | null;
  n: number;
}

export interface StatusIntervalPoint {
  minute: number;
  occupied: IntervalValue;
  mainOccupied: IntervalValue;
  fastTrackOccupied: IntervalValue;
  waiting: IntervalValue;
  boarders: IntervalValue;
}

export interface FlowIntervalPoint {
  hour: number;
  arrivals: IntervalValue;
  departures: IntervalValue;
}

export interface Flow15IntervalPoint {
  minute: number;
  arrivals: IntervalValue;
  departures: IntervalValue;
}

export interface AggregateResult {
  scenario: ScenarioConfig;
  algorithmVersion: string;
  replicationCount: number;
  metrics: Record<MetricKey, IntervalValue>;
  tierWaits: Record<AcuityTier, { median: IntervalValue; p90: IntervalValue }>;
  status: StatusIntervalPoint[];
  flow: FlowIntervalPoint[];
  flow15: Flow15IntervalPoint[];
  diagnostics: {
    maxMainOccupied: number;
    maxFastTrackOccupied: number;
    allTimestampsNondecreasing: boolean;
    allPatientTimelinesValid: boolean;
  };
  elapsedMilliseconds: number;
}

export interface ComparisonResult {
  a: AggregateResult;
  b: AggregateResult;
  deltas: Record<MetricKey, IntervalValue>;
  percentDeltas: Record<MetricKey, IntervalValue>;
  reversePercentDeltas: Record<MetricKey, IntervalValue>;
}

export type SensitivityParameter =
  | 'arrivalRate'
  | 'totalSpaces'
  | 'treatmentTimeScale'
  | 'overallAdmissionRate'
  | 'boardingMedianMinutes'
  | 'fastTrackSpaces';

export type SensitivityOutcome =
  | 'medianWait'
  | 'p90Wait'
  | 'boarderHours'
  | 'highOccupancyTime'
  | 'departures'
  | 'remainingInSystem';

export interface SensitivityPoint {
  value: number;
  outcome: IntervalValue;
}

export interface SensitivityResult {
  scenarioName: string;
  scenarioKey: string;
  parameter: SensitivityParameter;
  outcome: SensitivityOutcome;
  baselineValue: number;
  replicationsPerPoint: number;
  seed: number;
  algorithmVersion: string;
  points: SensitivityPoint[];
  elapsedMilliseconds: number;
}
