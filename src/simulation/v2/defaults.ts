import { normalizeProfile } from '../../presets/profiles';
import type {
  CapacityKeyV2,
  DiagnosticProbabilityConfigV2,
  LocationDefinitionV2,
  LocationKind,
  PathwayKind,
  ResourceKind,
  ResourceUnitV2,
  ScenarioConfigV2,
  VisualizerCapacitiesV2,
} from './types';

const RAW_WEEKDAY_PROFILE = [
  0.52, 0.46, 0.43, 0.42, 0.47, 0.6, 0.79, 1.0, 1.18, 1.3, 1.38, 1.43, 1.42, 1.39, 1.36, 1.34, 1.3,
  1.24, 1.16, 1.05, 0.93, 0.81, 0.7, 0.6,
];

export const VISUALIZER_LOCATIONS: readonly LocationDefinitionV2[] = [
  {
    id: 'walkInEntrance',
    label: 'Walk-in entrance',
    shortLabel: 'Walk-in',
    group: 'input',
    map: { x: 2, y: 9, width: 13, height: 13 },
  },
  {
    id: 'ambulanceArrival',
    label: 'Ambulance arrival',
    shortLabel: 'Ambulance',
    group: 'input',
    map: { x: 2, y: 27, width: 13, height: 13 },
  },
  {
    id: 'triage',
    label: 'Triage',
    shortLabel: 'Triage',
    group: 'input',
    map: { x: 19, y: 8, width: 17, height: 16 },
  },
  {
    id: 'waiting',
    label: 'Waiting room',
    shortLabel: 'Waiting',
    group: 'input',
    map: { x: 19, y: 29, width: 17, height: 38 },
  },
  {
    id: 'trauma',
    label: 'Trauma bays',
    shortLabel: 'Trauma',
    group: 'throughput',
    map: { x: 40, y: 5, width: 20, height: 14 },
  },
  {
    id: 'mainTreatment',
    label: 'Main treatment',
    shortLabel: 'Main',
    group: 'throughput',
    map: { x: 40, y: 23, width: 34, height: 31 },
  },
  {
    id: 'fastTrack',
    label: 'Fast track',
    shortLabel: 'Fast track',
    group: 'throughput',
    map: { x: 40, y: 56, width: 16, height: 15 },
  },
  {
    id: 'hallway',
    label: 'Hallway treatment',
    shortLabel: 'Hallway',
    group: 'throughput',
    map: { x: 60, y: 56, width: 14, height: 15 },
  },
  {
    id: 'behavioralHealth',
    label: 'Behavioral health',
    shortLabel: 'Behavioral',
    group: 'throughput',
    map: { x: 40, y: 75, width: 16, height: 16 },
  },
  {
    id: 'observation',
    label: 'Observation',
    shortLabel: 'Observation',
    group: 'throughput',
    map: { x: 60, y: 75, width: 14, height: 16 },
  },
  {
    id: 'ct',
    label: 'CT',
    shortLabel: 'CT',
    group: 'diagnostics',
    map: { x: 78, y: 5, width: 9, height: 13 },
  },
  {
    id: 'mri',
    label: 'MRI',
    shortLabel: 'MRI',
    group: 'diagnostics',
    map: { x: 89, y: 5, width: 9, height: 13 },
  },
  {
    id: 'xray',
    label: 'X-ray',
    shortLabel: 'X-ray',
    group: 'diagnostics',
    map: { x: 78, y: 22, width: 9, height: 13 },
  },
  {
    id: 'ultrasound',
    label: 'Ultrasound',
    shortLabel: 'US',
    group: 'diagnostics',
    map: { x: 89, y: 22, width: 9, height: 13 },
  },
  {
    id: 'laboratory',
    label: 'Laboratory',
    shortLabel: 'Lab',
    group: 'diagnostics',
    map: { x: 78, y: 39, width: 20, height: 13 },
  },
  {
    id: 'boarding',
    label: 'Boarding census',
    shortLabel: 'Boarding',
    group: 'output',
    map: { x: 76, y: 54, width: 22, height: 29 },
  },
  {
    id: 'dischargeLounge',
    label: 'Discharge lounge',
    shortLabel: 'Discharge',
    group: 'output',
    map: { x: 76, y: 86, width: 22, height: 10 },
  },
] as const;

export const DEFAULT_VISUALIZER_SCENARIO: ScenarioConfigV2 = {
  schemaVersion: 2,
  modelVersion: 'edts-model-v2',
  name: 'Baseline',
  seed: 20_260_831,
  replications: 40,
  window: { warmUpMinutes: 24 * 60, analysisMinutes: 7 * 24 * 60 },
  demand: {
    meanArrivalsPerHour: 6,
    hourlyMultipliers: normalizeProfile(RAW_WEEKDAY_PROFILE),
    esiMix: { 1: 0.03, 2: 0.16, 3: 0.43, 4: 0.3, 5: 0.08 },
    arrivalModeMix: { walkIn: 0.82, ambulance: 0.18 },
  },
  capacities: {
    triageSpots: 3,
    mainRooms: 18,
    fastTrackSpaces: 4,
    hallwayBeds: 6,
    traumaBays: 2,
    observationBeds: 0,
    behavioralHealthBeds: 4,
    ctScanners: 2,
    mriScanners: 1,
    xrayRooms: 2,
    ultrasoundRooms: 1,
    labProcessors: 4,
    dischargeSeats: 6,
    boardingBeds: 8,
  },
  durations: {
    triageMedian: 11,
    treatmentMedianByEsi: { 1: 190, 2: 160, 3: 125, 4: 78, 5: 48 },
    reassessmentMedian: 24,
    ctMedian: 34,
    mriMedian: 58,
    xrayMedian: 24,
    ultrasoundMedian: 38,
    labMedian: 48,
    dischargeLoungeMedian: 26,
    boardingMedian: 260,
    variability: 0.55,
    globalScale: 1,
  },
  pathwayTreatmentMultipliers: {
    minorInjury: 1,
    medical: 1,
    abdominal: 1,
    behavioralHealth: 1,
  },
  diagnosticProbabilities: {
    labByPathway: {
      minorInjury: 0.12,
      medical: 0.7,
      abdominal: 0.86,
      behavioralHealth: 0.32,
    },
    xrayMinorInjury: 0.68,
    ctMedicalHighAcuity: 0.52,
    ctMedicalOther: 0.3,
    ctAbdominal: 0.46,
    ultrasoundAbdominal: 0.34,
    mriMedical: 0.045,
    mriBehavioralHealth: 0.045,
  },
  admissionRates: { 1: 0.7, 2: 0.46, 3: 0.22, 4: 0.07, 5: 0.015 },
  interventions: [],
};

export function cloneVisualizerScenario(scenario: ScenarioConfigV2): ScenarioConfigV2 {
  return {
    ...scenario,
    window: { ...scenario.window },
    demand: {
      ...scenario.demand,
      hourlyMultipliers: [...scenario.demand.hourlyMultipliers],
      esiMix: { ...scenario.demand.esiMix },
      arrivalModeMix: { ...scenario.demand.arrivalModeMix },
    },
    capacities: { ...scenario.capacities },
    durations: {
      ...scenario.durations,
      treatmentMedianByEsi: { ...scenario.durations.treatmentMedianByEsi },
    },
    pathwayTreatmentMultipliers: { ...scenario.pathwayTreatmentMultipliers },
    diagnosticProbabilities: {
      ...scenario.diagnosticProbabilities,
      labByPathway: { ...scenario.diagnosticProbabilities.labByPathway },
    },
    admissionRates: { ...scenario.admissionRates },
    interventions: scenario.interventions.map((intervention) => ({
      ...intervention,
      actions: intervention.actions.map((action) => ({ ...action })),
    })),
  };
}

/** Adds fields introduced within schema v2 so saved and exported v2.1 scenarios remain usable. */
export function migrateVisualizerScenarioV2(input: unknown): unknown {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return input;
  const candidate = input as Record<string, unknown>;
  const predatesAdvancedAssumptions =
    candidate.pathwayTreatmentMultipliers == null && candidate.diagnosticProbabilities == null;
  const capacities =
    typeof candidate.capacities === 'object' &&
    candidate.capacities !== null &&
    !Array.isArray(candidate.capacities)
      ? (candidate.capacities as Partial<VisualizerCapacitiesV2>)
      : undefined;
  const pathwayTreatmentMultipliers =
    typeof candidate.pathwayTreatmentMultipliers === 'object' &&
    candidate.pathwayTreatmentMultipliers !== null &&
    !Array.isArray(candidate.pathwayTreatmentMultipliers)
      ? (candidate.pathwayTreatmentMultipliers as Partial<Record<PathwayKind, number>>)
      : {};
  const diagnosticProbabilities =
    typeof candidate.diagnosticProbabilities === 'object' &&
    candidate.diagnosticProbabilities !== null &&
    !Array.isArray(candidate.diagnosticProbabilities)
      ? (candidate.diagnosticProbabilities as Partial<DiagnosticProbabilityConfigV2>)
      : {};
  const labByPathway =
    typeof diagnosticProbabilities.labByPathway === 'object' &&
    diagnosticProbabilities.labByPathway !== null &&
    !Array.isArray(diagnosticProbabilities.labByPathway)
      ? diagnosticProbabilities.labByPathway
      : {};

  return {
    ...candidate,
    ...(predatesAdvancedAssumptions &&
    capacities?.ctScanners === 1 &&
    capacities.labProcessors === 2
      ? { capacities: { ...capacities, ctScanners: 2, labProcessors: 4 } }
      : {}),
    pathwayTreatmentMultipliers: {
      ...DEFAULT_VISUALIZER_SCENARIO.pathwayTreatmentMultipliers,
      ...pathwayTreatmentMultipliers,
    },
    diagnosticProbabilities: {
      ...DEFAULT_VISUALIZER_SCENARIO.diagnosticProbabilities,
      ...diagnosticProbabilities,
      labByPathway: {
        ...DEFAULT_VISUALIZER_SCENARIO.diagnosticProbabilities.labByPathway,
        ...labByPathway,
      },
    },
  };
}

const RESOURCE_CONFIG: Record<
  CapacityKeyV2,
  { kind: ResourceKind; locationId: LocationKind; prefix: string; label: string }
> = {
  triageSpots: { kind: 'triageSpot', locationId: 'triage', prefix: 'TRI', label: 'Triage' },
  mainRooms: { kind: 'mainRoom', locationId: 'mainTreatment', prefix: 'R', label: 'Room' },
  fastTrackSpaces: {
    kind: 'fastTrackSpace',
    locationId: 'fastTrack',
    prefix: 'FT',
    label: 'Fast track',
  },
  hallwayBeds: { kind: 'hallwayBed', locationId: 'hallway', prefix: 'H', label: 'Hallway' },
  traumaBays: { kind: 'traumaBay', locationId: 'trauma', prefix: 'T', label: 'Trauma' },
  observationBeds: {
    kind: 'observationBed',
    locationId: 'observation',
    prefix: 'OBS',
    label: 'Observation',
  },
  behavioralHealthBeds: {
    kind: 'behavioralHealthBed',
    locationId: 'behavioralHealth',
    prefix: 'BH',
    label: 'Behavioral health',
  },
  ctScanners: { kind: 'ctScanner', locationId: 'ct', prefix: 'CT', label: 'CT' },
  mriScanners: { kind: 'mriScanner', locationId: 'mri', prefix: 'MRI', label: 'MRI' },
  xrayRooms: { kind: 'xrayRoom', locationId: 'xray', prefix: 'XR', label: 'X-ray' },
  ultrasoundRooms: {
    kind: 'ultrasoundRoom',
    locationId: 'ultrasound',
    prefix: 'US',
    label: 'Ultrasound',
  },
  labProcessors: {
    kind: 'labProcessor',
    locationId: 'laboratory',
    prefix: 'LAB',
    label: 'Lab processor',
  },
  dischargeSeats: {
    kind: 'dischargeSeat',
    locationId: 'dischargeLounge',
    prefix: 'DL',
    label: 'Discharge seat',
  },
  boardingBeds: {
    kind: 'boardingBed',
    locationId: 'boarding',
    prefix: 'B',
    label: 'Off-room boarding space',
  },
};

export function buildResourceUnits(capacities: VisualizerCapacitiesV2): ResourceUnitV2[] {
  return (Object.keys(RESOURCE_CONFIG) as CapacityKeyV2[]).flatMap((capacityKey) => {
    const config = RESOURCE_CONFIG[capacityKey];
    return Array.from({ length: capacities[capacityKey] }, (_, index) => ({
      id: `${config.prefix}-${String(index + 1).padStart(2, '0')}`,
      kind: config.kind,
      locationId: config.locationId,
      label: `${config.label} ${index + 1}`,
      ordinal: index,
    }));
  });
}

export const CAPACITY_LABELS: Record<CapacityKeyV2, string> = {
  triageSpots: 'Triage spaces',
  mainRooms: 'Main treatment rooms',
  fastTrackSpaces: 'Fast-track spaces',
  hallwayBeds: 'Hallway treatment spaces',
  traumaBays: 'Trauma bays',
  observationBeds: 'Observation beds',
  behavioralHealthBeds: 'Behavioral-health spaces',
  ctScanners: 'CT scanners',
  mriScanners: 'MRI scanners',
  xrayRooms: 'X-ray rooms',
  ultrasoundRooms: 'Ultrasound rooms',
  labProcessors: 'Lab processors',
  dischargeSeats: 'Discharge-lounge seats',
  boardingBeds: 'Off-room boarding spaces',
};
