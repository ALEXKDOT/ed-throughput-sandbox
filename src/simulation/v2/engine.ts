import { median } from '../metrics';
import { deriveSeed, Random } from '../random';
import { buildResourceUnits } from './defaults';
import { EventQueueV2, type EngineEventV2 } from './eventQueue';
import { keyedUniform, sampleServiceMinutes, V2_RNG_VERSION } from './random';
import {
  ESI_LEVELS,
  type ArrivalMode,
  type CapacityKeyV2,
  type Disposition,
  type EsiLevel,
  type LiveKpisV2,
  type LocationKind,
  type PathwayKind,
  type PatientIdentityV2,
  type PatientSnapshotV2,
  type PatientStatus,
  type ReplayCheckpointV2,
  type ReplayPatchV2,
  type ReplayStateV2,
  type ReplicationMetricsV2,
  type ReplicationSeriesPointV2,
  type ReplicationSummaryV2,
  type ResourceDisplayStateV2,
  type ResourceKind,
  type ResourceSnapshotV2,
  type ResourceUnitV2,
  type ScenarioConfigV2,
  type ServiceKind,
  type SimulationTraceV2,
  type TraceDomainEventV2,
  type TraceFrameV2,
  type VisualizerCapacitiesV2,
} from './types';

export const V2_ENGINE_VERSION = `edts-model-v2.1 | ${V2_RNG_VERSION} | trace-v2.1`;
const SERIES_MINUTES = 60;

const LWBS_PROBABILITY_BY_ESI: Record<EsiLevel, number> = {
  1: 0.002,
  2: 0.01,
  3: 0.04,
  4: 0.1,
  5: 0.16,
};

const LWBS_BASE_MINUTES_BY_ESI: Record<EsiLevel, number> = {
  1: 24 * 60,
  2: 16 * 60,
  3: 12 * 60,
  4: 10 * 60,
  5: 8 * 60,
};

type DiagnosticService = Extract<ServiceKind, 'ct' | 'mri' | 'xray' | 'ultrasound' | 'lab'>;
type QueueName =
  'triage' | 'treatment' | 'ct' | 'mri' | 'xray' | 'ultrasound' | 'lab' | 'boarding' | 'discharge';

interface PatientBlueprint extends PatientIdentityV2 {
  diagnostics: DiagnosticService[];
  dispositionRoll: number;
  exitRiskRoll: number;
  lwbsDeadlineMinutes?: number;
}

interface RuntimePatient extends PatientBlueprint {
  active: boolean;
  locationId: LocationKind;
  statuses: Set<PatientStatus>;
  assignedTreatmentResourceId?: string;
  activeServiceResourceId?: string;
  treatmentStartMinute?: number;
  departureMinute?: number;
  disposition?: Disposition;
  diagnosticIndex: number;
  diagnosticQueueEnteredAt?: number;
}

interface RuntimeResource extends ResourceUnitV2 {
  operational: 'open' | 'closed' | 'blocked';
  occupancy: 'free' | 'occupied' | 'reserved';
  patientId?: number;
}

interface QueueEntry {
  patientId: number;
  enteredAt: number;
}

interface EngineQueues {
  triage: QueueEntry[];
  treatment: QueueEntry[];
  ct: QueueEntry[];
  mri: QueueEntry[];
  xray: QueueEntry[];
  ultrasound: QueueEntry[];
  lab: QueueEntry[];
  boarding: QueueEntry[];
  discharge: QueueEntry[];
}

interface EngineOptionsV2 {
  recordTrace?: boolean;
  selection?: SimulationTraceV2['selection'];
}

type UnsequencedEngineEventV2 = EngineEventV2 extends infer Event
  ? Event extends EngineEventV2
    ? Omit<Event, 'sequence'>
    : never
  : never;

const DIAGNOSTIC_RESOURCE_KIND: Record<DiagnosticService, ResourceKind> = {
  ct: 'ctScanner',
  mri: 'mriScanner',
  xray: 'xrayRoom',
  ultrasound: 'ultrasoundRoom',
  lab: 'labProcessor',
};

const DIAGNOSTIC_LOCATION: Record<DiagnosticService, LocationKind> = {
  ct: 'ct',
  mri: 'mri',
  xray: 'xray',
  ultrasound: 'ultrasound',
  lab: 'laboratory',
};

const TREATMENT_KINDS = new Set<ResourceKind>([
  'mainRoom',
  'fastTrackSpace',
  'hallwayBed',
  'traumaBay',
  'behavioralHealthBed',
]);

function samplePoisson(mean: number, random: Random): number {
  if (!(mean > 0)) return 0;
  const limit = Math.exp(-mean);
  let product = 1;
  let count = 0;
  do {
    count += 1;
    product *= random.next();
  } while (product > limit);
  return count - 1;
}

function selectEsi(uniform: number, mix: ScenarioConfigV2['demand']['esiMix']): EsiLevel {
  let cumulative = 0;
  for (const esi of ESI_LEVELS) {
    cumulative += mix[esi];
    if (uniform < cumulative) return esi;
  }
  return 5;
}

function selectPathway(uniform: number, esi: EsiLevel): PathwayKind {
  if (uniform < 0.08) return 'behavioralHealth';
  if (uniform < (esi >= 4 ? 0.52 : 0.28)) return 'minorInjury';
  if (uniform < 0.62) return 'abdominal';
  return 'medical';
}

function buildDiagnostics(
  scenario: ScenarioConfigV2,
  replication: number,
  id: number,
  esi: EsiLevel,
  pathway: PathwayKind,
): DiagnosticService[] {
  const draws = Array.from({ length: 6 }, (_, index) =>
    keyedUniform(scenario.seed, replication, id, 'diagnostics', index),
  );
  const values: DiagnosticService[] = [];
  const labProbability =
    pathway === 'abdominal'
      ? 0.86
      : pathway === 'medical'
        ? 0.7
        : pathway === 'behavioralHealth'
          ? 0.32
          : 0.12;
  if (draws[0]! < labProbability) values.push('lab');
  if (pathway === 'minorInjury' && draws[1]! < 0.68) values.push('xray');
  if (pathway === 'medical' && draws[2]! < (esi <= 2 ? 0.52 : 0.3)) values.push('ct');
  if (pathway === 'abdominal' && draws[3]! < 0.46) values.push('ct');
  if (pathway === 'abdominal' && draws[4]! < 0.34) values.push('ultrasound');
  if ((pathway === 'medical' || pathway === 'behavioralHealth') && draws[5]! < 0.045) {
    values.push('mri');
  }
  return values;
}

function arrivalScaleAt(scenario: ScenarioConfigV2, minute: number): number {
  return scenario.interventions
    .filter((intervention) => intervention.atMinute <= minute)
    .flatMap((intervention) => intervention.actions)
    .filter(
      (action): action is Extract<typeof action, { kind: 'scaleArrivals' }> =>
        action.kind === 'scaleArrivals',
    )
    .reduce((scale, action) => scale * action.multiplier, 1);
}

export function generatePatientBlueprintsV2(
  scenario: ScenarioConfigV2,
  replication: number,
): PatientBlueprint[] {
  const start = -scenario.window.warmUpMinutes;
  const end = scenario.window.analysisMinutes;
  const arrivals: number[] = [];

  for (let minuteStart = start; minuteStart < end; minuteStart += 1) {
    const hourOfDay = ((Math.floor(minuteStart / 60) % 24) + 24) % 24;
    const minuteOrdinal = minuteStart - start;
    const random = new Random(deriveSeed(scenario.seed, 0x56324152, replication, minuteOrdinal));
    const expected =
      (scenario.demand.meanArrivalsPerHour *
        (scenario.demand.hourlyMultipliers[hourOfDay] ?? 1) *
        arrivalScaleAt(scenario, minuteStart)) /
      60;
    const count = samplePoisson(expected, random);
    const offsets = Array.from({ length: count }, () => random.next()).sort((a, b) => a - b);
    for (const offset of offsets) {
      arrivals.push(minuteStart + offset);
    }
  }

  arrivals.sort((a, b) => a - b);
  return arrivals.map((arrivalMinute, id) => {
    const esi = selectEsi(
      keyedUniform(scenario.seed, replication, id, 'esi'),
      scenario.demand.esiMix,
    );
    const arrivalMode: ArrivalMode =
      keyedUniform(scenario.seed, replication, id, 'arrivalMode') <
      scenario.demand.arrivalModeMix.walkIn
        ? 'walkIn'
        : 'ambulance';
    const pathway = selectPathway(keyedUniform(scenario.seed, replication, id, 'pathway'), esi);
    const patienceDraw = keyedUniform(scenario.seed, replication, id, 'patience');
    const lwbsRiskRoll = keyedUniform(scenario.seed, replication, id, 'lwbs');
    const lwbsDeadlineMinutes =
      lwbsRiskRoll < LWBS_PROBABILITY_BY_ESI[esi]
        ? LWBS_BASE_MINUTES_BY_ESI[esi] * (0.75 + patienceDraw * 1.75)
        : undefined;
    return {
      id,
      displayId: `P${String(id + 1).padStart(4, '0')}`,
      arrivalMinute,
      esi,
      arrivalMode,
      pathway,
      diagnostics: buildDiagnostics(scenario, replication, id, esi, pathway),
      dispositionRoll: keyedUniform(scenario.seed, replication, id, 'disposition'),
      exitRiskRoll: keyedUniform(scenario.seed, replication, id, 'patience', 1),
      lwbsDeadlineMinutes,
    };
  });
}

function queueSort(a: QueueEntry, b: QueueEntry, patients: Map<number, RuntimePatient>): number {
  const patientA = patients.get(a.patientId)!;
  const patientB = patients.get(b.patientId)!;
  return patientA.esi - patientB.esi || a.enteredAt - b.enteredAt || a.patientId - b.patientId;
}

function copySnapshot<T>(value: T): T {
  return structuredClone(value);
}

function shortDigest(scenario: ScenarioConfigV2): string {
  const text = JSON.stringify(scenario);
  let hash = 2_166_136_261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `v2-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function emptyDispositionCounts(): Record<Disposition, number> {
  return { discharge: 0, admit: 0, transfer: 0, lwbs: 0, lbtc: 0, elope: 0, death: 0 };
}

export function runReplicationV2(
  scenario: ScenarioConfigV2,
  replication: number,
  options: EngineOptionsV2 = {},
): ReplicationSummaryV2 {
  const analysisEnd = scenario.window.analysisMinutes;
  const patients = new Map<number, RuntimePatient>();
  const resources = new Map<string, RuntimeResource>();
  const capacities: VisualizerCapacitiesV2 = { ...scenario.capacities };
  for (const unit of buildResourceUnits(capacities)) {
    resources.set(unit.id, { ...unit, operational: 'open', occupancy: 'free' });
  }
  const blueprints = generatePatientBlueprintsV2(scenario, replication);
  for (const blueprint of blueprints) {
    patients.set(blueprint.id, {
      ...blueprint,
      active: false,
      locationId: blueprint.arrivalMode === 'walkIn' ? 'walkInEntrance' : 'ambulanceArrival',
      statuses: new Set(),
      diagnosticIndex: 0,
    });
  }

  const queues: EngineQueues = {
    triage: [],
    treatment: [],
    ct: [],
    mri: [],
    xray: [],
    ultrasound: [],
    lab: [],
    boarding: [],
    discharge: [],
  };
  const eventQueue = new EventQueueV2();
  let eventSequence = 0;
  const schedule = (event: UnsequencedEngineEventV2) =>
    eventQueue.push({ ...event, sequence: eventSequence++ } as EngineEventV2);
  for (const blueprint of blueprints) {
    schedule({ kind: 'arrival', time: blueprint.arrivalMinute, patientId: blueprint.id });
  }
  for (const intervention of scenario.interventions) {
    schedule({
      kind: 'interventionApply',
      time: intervention.atMinute,
      interventionId: intervention.id,
    });
  }

  const serviceScales = new Map<ServiceKind, number>();
  let boardingScale = 1;
  let arrivalsInAnalysis = 0;
  let departuresInAnalysis = 0;
  let arrivalsProcessed = 0;
  let departuresProcessed = 0;
  const activePatientIds = new Set<number>();
  let boarderCensus = 0;
  const departuresByDisposition = emptyDispositionCounts();
  const doorToRoom: number[] = [];
  const lengthsOfStay: number[] = [];
  const imagingDelays: number[] = [];
  let boarderMinutes = 0;
  let waitingMinutes = 0;
  let peakCensus = 0;
  let peakWaiting = 0;
  let peakMinute = 0;
  let maxActivePatients = 0;
  let maxOwnedResources = 0;
  let previousTimestamp = Number.NEGATIVE_INFINITY;
  let timestampsNondecreasing = true;
  let processedEventCount = 0;
  let lastIntegratedMinute = -scenario.window.warmUpMinutes;
  let nextSampleMinute = 0;
  let analysisInitialized = false;
  const series: ReplicationSeriesPointV2[] = [];

  const traceFrames: TraceFrameV2[] = [];
  const checkpoints: ReplayCheckpointV2[] = [];
  let initialCheckpoint: ReplayCheckpointV2 | undefined;
  let nextCheckpointMinute = 60;
  let frameSequence = 0;
  const dirtyPatients = new Set<number>();
  const removedPatients = new Set<number>();
  const dirtyResources = new Set<string>();
  const initialTracePatientIds = new Set<number>();
  let traceEvents: TraceDomainEventV2[] = [];

  const activePatients = () =>
    [...activePatientIds].map((patientId) => patients.get(patientId)!).filter(Boolean);
  const activeCount = () => activePatientIds.size;
  const queueWaitingCount = () => queues.triage.length + queues.treatment.length;
  const boarderCount = () => boarderCensus;
  const imagingQueueCount = () =>
    queues.ct.length +
    queues.mri.length +
    queues.xray.length +
    queues.ultrasound.length +
    queues.lab.length;
  const treatmentResources = () =>
    [...resources.values()].filter((resource) => TREATMENT_KINDS.has(resource.kind));
  const occupiedTreatmentCount = () =>
    treatmentResources().filter((resource) => resource.occupancy !== 'free').length;

  const queueLengthForResource = (kind: ResourceKind): number => {
    if (kind === 'triageSpot') return queues.triage.length;
    if (TREATMENT_KINDS.has(kind)) return queues.treatment.length;
    if (kind === 'ctScanner') return queues.ct.length;
    if (kind === 'mriScanner') return queues.mri.length;
    if (kind === 'xrayRoom') return queues.xray.length;
    if (kind === 'ultrasoundRoom') return queues.ultrasound.length;
    if (kind === 'labProcessor') return queues.lab.length;
    if (kind === 'boardingBed') return queues.boarding.length;
    if (kind === 'dischargeSeat') return queues.discharge.length;
    return 0;
  };

  const resourceSnapshot = (resource: RuntimeResource): ResourceSnapshotV2 => {
    let state: ResourceDisplayStateV2 =
      resource.occupancy === 'free' ? 'available' : resource.occupancy;
    if (resource.operational === 'closed') state = 'closed';
    if (resource.operational === 'blocked') state = 'blocked';
    return {
      id: resource.id,
      kind: resource.kind,
      locationId: resource.locationId,
      label: resource.label,
      ordinal: resource.ordinal,
      state,
      patientId: resource.patientId,
      queueLength: queueLengthForResource(resource.kind),
    };
  };

  const patientSnapshot = (patient: RuntimePatient, minute: number): PatientSnapshotV2 => ({
    id: patient.id,
    displayId: patient.displayId,
    arrivalMinute: patient.arrivalMinute,
    esi: patient.esi,
    arrivalMode: patient.arrivalMode,
    pathway: patient.pathway,
    active: patient.active,
    locationId: patient.locationId,
    statuses: [...patient.statuses].sort(),
    assignedTreatmentResourceId: patient.assignedTreatmentResourceId,
    activeServiceResourceId: patient.activeServiceResourceId,
    disposition: patient.disposition,
    waitMinutes: Math.max(
      0,
      (patient.treatmentStartMinute ?? Math.max(minute, patient.arrivalMinute)) -
        patient.arrivalMinute,
    ),
    losMinutes: Math.max(0, (patient.departureMinute ?? minute) - patient.arrivalMinute),
  });

  const liveKpis = (_minute: number): LiveKpisV2 => ({
    census: activeCount(),
    waiting: queueWaitingCount(),
    occupiedTreatment: occupiedTreatmentCount(),
    treatmentCapacity: treatmentResources().filter((resource) => resource.operational === 'open')
      .length,
    imagingQueue: imagingQueueCount(),
    boarders: boarderCount(),
    departures: departuresInAnalysis,
    medianDoorToRoom: median(doorToRoom),
  });

  const replayState = (minute: number): ReplayStateV2 => ({
    minute,
    patients: Object.fromEntries(
      activePatients().map((patient) => [String(patient.id), patientSnapshot(patient, minute)]),
    ),
    resources: Object.fromEntries(
      [...resources.values()].map((resource) => [resource.id, resourceSnapshot(resource)]),
    ),
    live: liveKpis(minute),
  });

  const markPatient = (patient: RuntimePatient) => {
    if (options.recordTrace) dirtyPatients.add(patient.id);
  };
  const markResource = (resource: RuntimeResource) => {
    if (options.recordTrace) dirtyResources.add(resource.id);
  };
  const markQueueResources = (name: QueueName) => {
    if (!options.recordTrace) return;
    for (const resource of resources.values()) {
      const observesQueue =
        (name === 'triage' && resource.kind === 'triageSpot') ||
        (name === 'treatment' && TREATMENT_KINDS.has(resource.kind)) ||
        (name === 'ct' && resource.kind === 'ctScanner') ||
        (name === 'mri' && resource.kind === 'mriScanner') ||
        (name === 'xray' && resource.kind === 'xrayRoom') ||
        (name === 'ultrasound' && resource.kind === 'ultrasoundRoom') ||
        (name === 'lab' && resource.kind === 'labProcessor') ||
        (name === 'boarding' && resource.kind === 'boardingBed') ||
        (name === 'discharge' && resource.kind === 'dischargeSeat');
      if (observesQueue) dirtyResources.add(resource.id);
    }
  };
  const emit = (event: TraceDomainEventV2) => {
    if (options.recordTrace) traceEvents.push(event);
  };

  const setLocation = (patient: RuntimePatient, locationId: LocationKind, label: string) => {
    const previous = patient.locationId;
    if (previous === locationId) return;
    patient.locationId = locationId;
    markPatient(patient);
    emit({
      kind: 'move',
      patientId: patient.id,
      fromLocationId: previous,
      toLocationId: locationId,
      label,
    });
  };

  const setStatuses = (patient: RuntimePatient, statuses: PatientStatus[]) => {
    patient.statuses = new Set(statuses);
    markPatient(patient);
    emit({
      kind: 'statusChange',
      patientId: patient.id,
      label: statuses.length > 0 ? `Status: ${statuses.join(', ')}` : 'No active wait status',
    });
  };

  const occupy = (resource: RuntimeResource, patient: RuntimePatient, reserved = false) => {
    if (resource.occupancy !== 'free') throw new Error(`Resource ${resource.id} is already owned.`);
    resource.occupancy = reserved ? 'reserved' : 'occupied';
    resource.patientId = patient.id;
    markResource(resource);
  };

  const release = (resourceId: string | undefined, patientId: number) => {
    if (!resourceId) return;
    const resource = resources.get(resourceId);
    if (!resource || resource.patientId !== patientId) return;
    resource.occupancy = 'free';
    resource.patientId = undefined;
    markResource(resource);
  };

  const setReservation = (resourceId: string | undefined, patientId: number, reserved: boolean) => {
    if (!resourceId) return;
    const resource = resources.get(resourceId);
    if (!resource || resource.patientId !== patientId) return;
    resource.occupancy = reserved ? 'reserved' : 'occupied';
    markResource(resource);
  };

  const removeFromQueues = (patientId: number) => {
    for (const name of Object.keys(queues) as QueueName[]) {
      const previousLength = queues[name].length;
      queues[name] = queues[name].filter((entry) => entry.patientId !== patientId);
      if (queues[name].length !== previousLength) markQueueResources(name);
    }
  };

  const updateWaitingLocations = () => {
    const ordered = [...queues.treatment].sort((a, b) => queueSort(a, b, patients));
    ordered.forEach((entry) => {
      const patient = patients.get(entry.patientId)!;
      setLocation(patient, 'waiting', 'Moved to the waiting room');
    });
  };

  const serviceMultiplier = (service: ServiceKind) => serviceScales.get(service) ?? 1;
  const scheduleService = (
    patient: RuntimePatient,
    service: ServiceKind,
    resource: RuntimeResource,
    time: number,
  ) => {
    patient.activeServiceResourceId = resource.id;
    markPatient(patient);
    const multiplier = serviceMultiplier(service) * (service === 'boarding' ? boardingScale : 1);
    const duration = sampleServiceMinutes(
      scenario,
      replication,
      patient.id,
      patient.esi,
      service,
      0,
      multiplier,
    );
    schedule({
      kind: 'serviceComplete',
      time: time + duration,
      patientId: patient.id,
      service,
      resourceId: resource.id,
    });
    emit({
      kind:
        service === 'triage'
          ? 'triageStart'
          : service === 'initialTreatment'
            ? 'treatmentStart'
            : service === 'boarding'
              ? 'boardingStart'
              : 'serviceStart',
      patientId: patient.id,
      resourceId: resource.id,
      service,
      label: `${resource.label}: ${service.replaceAll(/([A-Z])/gu, ' $1').toLowerCase()} started`,
    });
  };

  const available = (kind: ResourceKind) =>
    [...resources.values()].find(
      (resource) =>
        resource.kind === kind && resource.operational === 'open' && resource.occupancy === 'free',
    );

  const treatmentKindsFor = (patient: RuntimePatient): ResourceKind[] => {
    if (patient.pathway === 'behavioralHealth') {
      return ['behavioralHealthBed', 'mainRoom', 'hallwayBed'];
    }
    if (patient.esi === 1) return ['traumaBay', 'mainRoom', 'hallwayBed'];
    if (patient.esi === 2) return ['mainRoom', 'traumaBay', 'hallwayBed'];
    if (patient.esi >= 4) return ['fastTrackSpace', 'mainRoom', 'hallwayBed'];
    return ['mainRoom', 'hallwayBed'];
  };

  const availableTreatment = (patient: RuntimePatient) => {
    for (const kind of treatmentKindsFor(patient)) {
      const resource = available(kind);
      if (resource) return resource;
    }
    return undefined;
  };

  const depart = (patient: RuntimePatient, disposition: Disposition, time: number) => {
    if (!patient.active) return;
    const wasBoarder = patient.disposition === 'admit';
    removeFromQueues(patient.id);
    release(patient.activeServiceResourceId, patient.id);
    release(patient.assignedTreatmentResourceId, patient.id);
    patient.activeServiceResourceId = undefined;
    patient.assignedTreatmentResourceId = undefined;
    patient.active = false;
    patient.departureMinute = time;
    patient.disposition = disposition;
    patient.statuses.clear();
    activePatientIds.delete(patient.id);
    if (wasBoarder) boarderCensus -= 1;
    departuresProcessed += 1;
    if (time >= 0 && time < analysisEnd) {
      departuresInAnalysis += 1;
      departuresByDisposition[disposition] += 1;
      lengthsOfStay.push(time - patient.arrivalMinute);
    }
    if (options.recordTrace) {
      dirtyPatients.delete(patient.id);
      removedPatients.add(patient.id);
    }
    emit({
      kind: 'departure',
      patientId: patient.id,
      disposition,
      fromLocationId: patient.locationId,
      toLocationId: 'exit',
      label: `${patient.displayId} departed: ${disposition}`,
    });
  };

  const queueDiagnostic = (patient: RuntimePatient, service: DiagnosticService, time: number) => {
    patient.diagnosticQueueEnteredAt = time;
    queues[service].push({ patientId: patient.id, enteredAt: time });
    markQueueResources(service);
    if (service === 'lab') {
      setStatuses(patient, ['awaitingSpecimenCollection', 'awaitingLabResults']);
    } else {
      setStatuses(patient, ['awaitingImaging']);
    }
  };

  const beginReassessment = (patient: RuntimePatient, time: number) => {
    const treatmentResource = patient.assignedTreatmentResourceId
      ? resources.get(patient.assignedTreatmentResourceId)
      : undefined;
    if (!treatmentResource) {
      throw new Error(`Patient ${patient.id} has no treatment resource for reassessment.`);
    }
    setStatuses(patient, ['awaitingReassessment']);
    scheduleService(patient, 'reassessment', treatmentResource, time);
  };

  const requestNextStage = (patient: RuntimePatient, time: number) => {
    const diagnostic = patient.diagnostics[patient.diagnosticIndex];
    if (diagnostic) queueDiagnostic(patient, diagnostic, time);
    else beginReassessment(patient, time);
  };

  const chooseDisposition = (patient: RuntimePatient): Disposition => {
    const roll = patient.dispositionRoll;
    if (patient.esi === 1 && roll < 0.012) return 'death';
    if (patient.esi <= 2 && roll < 0.035) return 'transfer';
    return roll < scenario.admissionRates[patient.esi] ? 'admit' : 'discharge';
  };

  const enqueueDisposition = (patient: RuntimePatient, time: number) => {
    const disposition = chooseDisposition(patient);
    patient.disposition = disposition;
    patient.activeServiceResourceId = undefined;
    if (disposition === 'death' || disposition === 'transfer') {
      depart(patient, disposition, time);
      return;
    }
    if (disposition === 'admit') {
      boarderCensus += 1;
      setStatuses(patient, ['admittedAwaitingBed']);
      queues.boarding.push({ patientId: patient.id, enteredAt: time });
      markQueueResources('boarding');
      const boardingDuration = sampleServiceMinutes(
        scenario,
        replication,
        patient.id,
        patient.esi,
        'boarding',
        0,
        serviceMultiplier('boarding') * boardingScale,
      );
      schedule({
        kind: 'boardingComplete',
        time: time + boardingDuration,
        patientId: patient.id,
      });
      if (patient.exitRiskRoll < 0.003) {
        schedule({
          kind: 'exitDeadline',
          time: time + 8 * 60,
          patientId: patient.id,
          disposition: 'elope',
        });
      }
      return;
    }
    setStatuses(patient, ['dischargePending', 'awaitingTransport']);
    queues.discharge.push({ patientId: patient.id, enteredAt: time });
    markQueueResources('discharge');
  };

  const dispatchTriage = (time: number) => {
    queues.triage.sort((a, b) => queueSort(a, b, patients));
    while (queues.triage.length > 0) {
      const resource = available('triageSpot');
      if (!resource) break;
      const entry = queues.triage.shift()!;
      markQueueResources('triage');
      const patient = patients.get(entry.patientId)!;
      if (!patient.active) continue;
      occupy(resource, patient);
      setLocation(patient, 'triage', 'Entered triage');
      setStatuses(patient, []);
      scheduleService(patient, 'triage', resource, time);
    }
  };

  const dispatchTreatment = (time: number) => {
    queues.treatment.sort((a, b) => queueSort(a, b, patients));
    while (queues.treatment.length > 0) {
      const index = queues.treatment.findIndex((entry) => {
        const patient = patients.get(entry.patientId);
        return patient?.active && availableTreatment(patient) != null;
      });
      if (index < 0) break;
      const [entry] = queues.treatment.splice(index, 1);
      markQueueResources('treatment');
      const patient = patients.get(entry!.patientId)!;
      const resource = availableTreatment(patient)!;
      occupy(resource, patient);
      patient.assignedTreatmentResourceId = resource.id;
      patient.treatmentStartMinute = time;
      patient.diagnosticIndex = 0;
      if (time >= 0 && time < analysisEnd) doorToRoom.push(time - patient.arrivalMinute);
      setLocation(patient, resource.locationId, `Moved to ${resource.label}`);
      setStatuses(patient, ['awaitingClinician', 'awaitingOrders']);
      scheduleService(patient, 'initialTreatment', resource, time);
      if (patient.esi >= 4 && patient.exitRiskRoll < 0.012) {
        schedule({
          kind: 'exitDeadline',
          time: time + 5 * 60,
          patientId: patient.id,
          disposition: 'lbtc',
        });
      }
    }
    updateWaitingLocations();
  };

  const dispatchDiagnostic = (service: DiagnosticService, time: number) => {
    const resourceKind = DIAGNOSTIC_RESOURCE_KIND[service];
    const queue = queues[service];
    queue.sort((a, b) => queueSort(a, b, patients));
    while (queue.length > 0) {
      const resource = available(resourceKind);
      if (!resource) break;
      const entry = queue.shift()!;
      markQueueResources(service);
      const patient = patients.get(entry.patientId)!;
      if (!patient.active) continue;
      occupy(resource, patient);
      patient.activeServiceResourceId = resource.id;
      if (patient.diagnosticQueueEnteredAt != null && time >= 0) {
        imagingDelays.push(time - patient.diagnosticQueueEnteredAt);
      }
      if (service === 'lab') {
        setStatuses(patient, ['awaitingLabResults']);
      } else {
        setReservation(patient.assignedTreatmentResourceId, patient.id, true);
        setLocation(patient, DIAGNOSTIC_LOCATION[service], `Moved to ${resource.label}`);
        setStatuses(patient, ['imagingInProgress']);
      }
      scheduleService(patient, service, resource, time);
    }
  };

  const dispatchBoarding = (_time: number) => {
    queues.boarding.sort((a, b) => queueSort(a, b, patients));
    while (queues.boarding.length > 0) {
      const resource = available('boardingBed');
      if (!resource) break;
      const entry = queues.boarding.shift()!;
      markQueueResources('boarding');
      const patient = patients.get(entry.patientId)!;
      if (!patient.active) continue;
      occupy(resource, patient);
      const treatmentId = patient.assignedTreatmentResourceId;
      release(treatmentId, patient.id);
      patient.assignedTreatmentResourceId = undefined;
      setLocation(patient, 'boarding', `Moved to ${resource.label}`);
      setStatuses(patient, ['admittedAwaitingBed']);
      patient.activeServiceResourceId = resource.id;
      markPatient(patient);
      emit({
        kind: 'boardingStart',
        patientId: patient.id,
        resourceId: resource.id,
        service: 'boarding',
        label: `${resource.label}: off-room boarding started`,
      });
    }
  };

  const dispatchDischarge = (time: number) => {
    queues.discharge.sort((a, b) => queueSort(a, b, patients));
    while (queues.discharge.length > 0) {
      const resource = available('dischargeSeat');
      if (!resource) break;
      const entry = queues.discharge.shift()!;
      markQueueResources('discharge');
      const patient = patients.get(entry.patientId)!;
      if (!patient.active) continue;
      occupy(resource, patient);
      release(patient.assignedTreatmentResourceId, patient.id);
      patient.assignedTreatmentResourceId = undefined;
      setLocation(patient, 'dischargeLounge', `Moved to ${resource.label}`);
      setStatuses(patient, ['awaitingTransport']);
      scheduleService(patient, 'dischargeLounge', resource, time);
    }
  };

  const dispatchAll = (time: number) => {
    dispatchTriage(time);
    dispatchTreatment(time);
    dispatchDiagnostic('ct', time);
    dispatchDiagnostic('mri', time);
    dispatchDiagnostic('xray', time);
    dispatchDiagnostic('ultrasound', time);
    dispatchDiagnostic('lab', time);
    dispatchBoarding(time);
    dispatchDischarge(time);
    dispatchTreatment(time);
    updateWaitingLocations();
  };

  const applyIntervention = (interventionId: string, time: number) => {
    const intervention = scenario.interventions.find(
      (candidate) => candidate.id === interventionId,
    );
    if (!intervention) return;
    for (const action of intervention.actions) {
      if (action.kind === 'addCapacity') {
        const key: CapacityKeyV2 = action.capacity;
        capacities[key] += action.count;
        const generated = buildResourceUnits(capacities);
        for (const unit of generated) {
          if (!resources.has(unit.id)) {
            const runtime: RuntimeResource = {
              ...unit,
              operational: 'open',
              occupancy: 'free',
            };
            resources.set(unit.id, runtime);
            markResource(runtime);
          }
        }
      } else if (action.kind === 'scaleService') {
        serviceScales.set(action.service, serviceMultiplier(action.service) * action.multiplier);
      } else if (action.kind === 'scaleBoarding') {
        boardingScale *= action.multiplier;
      }
    }
    emit({
      kind: 'intervention',
      label: `${intervention.label} applied at minute ${Math.round(time)}`,
    });
  };

  const processCompletion = (
    patient: RuntimePatient,
    service: ServiceKind,
    resourceId: string,
    time: number,
  ) => {
    if (!patient.active) return;
    emit({
      kind: service === 'triage' ? 'triageComplete' : 'serviceComplete',
      patientId: patient.id,
      resourceId,
      service,
      label: `${service.replaceAll(/([A-Z])/gu, ' $1').toLowerCase()} completed`,
    });

    if (service === 'triage') {
      release(resourceId, patient.id);
      patient.activeServiceResourceId = undefined;
      setStatuses(patient, ['awaitingRoom']);
      queues.treatment.push({ patientId: patient.id, enteredAt: time });
      markQueueResources('treatment');
      updateWaitingLocations();
      return;
    }
    if (service === 'initialTreatment') {
      patient.activeServiceResourceId = undefined;
      requestNextStage(patient, time);
      return;
    }
    if (
      service === 'ct' ||
      service === 'mri' ||
      service === 'xray' ||
      service === 'ultrasound' ||
      service === 'lab'
    ) {
      release(resourceId, patient.id);
      patient.activeServiceResourceId = undefined;
      if (service !== 'lab') {
        setReservation(patient.assignedTreatmentResourceId, patient.id, false);
        const treatmentResource = patient.assignedTreatmentResourceId
          ? resources.get(patient.assignedTreatmentResourceId)
          : undefined;
        if (treatmentResource)
          setLocation(
            patient,
            treatmentResource.locationId,
            `Returned to ${treatmentResource.label}`,
          );
      }
      patient.diagnosticIndex += 1;
      patient.diagnosticQueueEnteredAt = undefined;
      requestNextStage(patient, time);
      return;
    }
    if (service === 'reassessment') {
      patient.activeServiceResourceId = undefined;
      setStatuses(patient, ['admissionDecisionPending']);
      enqueueDisposition(patient, time);
      return;
    }
    if (service === 'dischargeLounge') {
      release(resourceId, patient.id);
      patient.activeServiceResourceId = undefined;
      depart(patient, 'discharge', time);
      return;
    }
    release(resourceId, patient.id);
    patient.activeServiceResourceId = undefined;
    depart(patient, 'admit', time);
  };

  const stateValues = (): Omit<ReplicationSeriesPointV2, 'minute'> => ({
    census: activeCount(),
    waiting: queueWaitingCount(),
    occupiedTreatment: occupiedTreatmentCount(),
    imagingQueue: imagingQueueCount(),
    boarders: boarderCount(),
    departures: departuresInAnalysis,
  });

  const sampleUntil = (time: number) => {
    while (nextSampleMinute <= Math.min(time, analysisEnd)) {
      series.push({ minute: nextSampleMinute, ...stateValues() });
      nextSampleMinute += SERIES_MINUTES;
    }
  };

  const integrate = (from: number, to: number) => {
    const start = Math.max(0, from);
    const end = Math.min(analysisEnd, to);
    if (end <= start) return;
    const duration = end - start;
    boarderMinutes += boarderCount() * duration;
    waitingMinutes += queueWaitingCount() * duration;
  };

  const initializeAnalysis = () => {
    if (analysisInitialized) return;
    analysisInitialized = true;
    const initialValues = stateValues();
    peakCensus = initialValues.census;
    peakWaiting = initialValues.waiting;
    peakMinute = 0;
    maxActivePatients = initialValues.census;
    maxOwnedResources = [...resources.values()].filter(
      (resource) => resource.occupancy !== 'free',
    ).length;
    if (!options.recordTrace) return;
    for (const patientId of activePatientIds) initialTracePatientIds.add(patientId);
    dirtyPatients.clear();
    removedPatients.clear();
    dirtyResources.clear();
    traceEvents = [];
    initialCheckpoint = {
      minute: 0,
      frameIndex: -1,
      state: copySnapshot(replayState(0)),
    };
    checkpoints.push(initialCheckpoint);
  };

  const recordFrame = (time: number) => {
    if (!options.recordTrace || time < 0) return;
    const patches: ReplayPatchV2[] = [];
    for (const patientId of [...removedPatients].sort((a, b) => a - b)) {
      patches.push({ kind: 'removePatient', patientId });
    }
    for (const patientId of [...dirtyPatients].sort((a, b) => a - b)) {
      const patient = patients.get(patientId);
      if (patient?.active)
        patches.push({ kind: 'upsertPatient', patient: patientSnapshot(patient, time) });
    }
    for (const resourceId of [...dirtyResources].sort()) {
      const resource = resources.get(resourceId);
      if (resource) patches.push({ kind: 'upsertResource', resource: resourceSnapshot(resource) });
    }
    if (patches.length === 0 && traceEvents.length === 0) return;
    const frame: TraceFrameV2 = {
      minute: time,
      sequence: frameSequence++,
      events: traceEvents,
      patches,
      live: liveKpis(time),
    };
    traceFrames.push(frame);
    dirtyPatients.clear();
    removedPatients.clear();
    dirtyResources.clear();
    traceEvents = [];

    if (time >= nextCheckpointMinute) {
      checkpoints.push({
        minute: time,
        frameIndex: traceFrames.length - 1,
        state: copySnapshot(replayState(time)),
      });
      while (nextCheckpointMinute <= time) nextCheckpointMinute += 60;
    }
  };

  while (eventQueue.size > 0) {
    const first = eventQueue.pop()!;
    if (first.time >= analysisEnd) break;
    if (!analysisInitialized && first.time >= 0) initializeAnalysis();
    if (analysisInitialized) sampleUntil(first.time);
    integrate(lastIntegratedMinute, first.time);
    lastIntegratedMinute = first.time;

    const batch = [first];
    let next = eventQueue.pop();
    while (next && next.time === first.time) {
      batch.push(next);
      next = eventQueue.pop();
    }
    if (next) eventQueue.push(next);

    for (const event of batch) {
      processedEventCount += 1;
      if (event.time < previousTimestamp) timestampsNondecreasing = false;
      previousTimestamp = event.time;
      if (event.kind === 'arrival') {
        const patient = patients.get(event.patientId)!;
        patient.active = true;
        activePatientIds.add(patient.id);
        patient.locationId =
          patient.arrivalMode === 'walkIn' ? 'walkInEntrance' : 'ambulanceArrival';
        setStatuses(patient, ['awaitingTriage']);
        queues.triage.push({ patientId: patient.id, enteredAt: event.time });
        markQueueResources('triage');
        arrivalsProcessed += 1;
        if (event.time >= 0) arrivalsInAnalysis += 1;
        if (patient.lwbsDeadlineMinutes != null) {
          schedule({
            kind: 'exitDeadline',
            time: event.time + patient.lwbsDeadlineMinutes,
            patientId: patient.id,
            disposition: 'lwbs',
          });
        }
        emit({
          kind: 'arrival',
          patientId: patient.id,
          toLocationId: patient.locationId,
          label: `${patient.displayId} arrived by ${patient.arrivalMode === 'walkIn' ? 'walk-in' : 'ambulance'}`,
        });
      } else if (event.kind === 'serviceComplete') {
        const patient = patients.get(event.patientId);
        if (patient) processCompletion(patient, event.service, event.resourceId, event.time);
      } else if (event.kind === 'boardingComplete') {
        const patient = patients.get(event.patientId);
        if (!patient?.active || patient.disposition !== 'admit') continue;
        emit({
          kind: 'serviceComplete',
          patientId: patient.id,
          resourceId: patient.activeServiceResourceId ?? patient.assignedTreatmentResourceId,
          service: 'boarding',
          label: 'Inpatient delay completed',
        });
        depart(patient, 'admit', event.time);
      } else if (event.kind === 'exitDeadline') {
        const patient = patients.get(event.patientId);
        if (!patient?.active) continue;
        if (event.disposition === 'lwbs' && patient.treatmentStartMinute == null) {
          depart(patient, 'lwbs', event.time);
        } else if (event.disposition === 'lbtc' && patient.disposition == null) {
          depart(patient, 'lbtc', event.time);
        } else if (event.disposition === 'elope' && patient.disposition === 'admit') {
          depart(patient, 'elope', event.time);
        }
      } else {
        applyIntervention(event.interventionId, event.time);
      }
    }

    dispatchAll(first.time);
    const current = stateValues();
    if (first.time >= 0) {
      if (current.census > peakCensus) {
        peakCensus = current.census;
        peakMinute = first.time;
      }
      peakWaiting = Math.max(peakWaiting, current.waiting);
      maxActivePatients = Math.max(maxActivePatients, current.census);
      maxOwnedResources = Math.max(
        maxOwnedResources,
        [...resources.values()].filter((resource) => resource.occupancy !== 'free').length,
      );
    }
    recordFrame(first.time);
  }

  if (!analysisInitialized) initializeAnalysis();
  sampleUntil(analysisEnd);
  integrate(lastIntegratedMinute, analysisEnd);

  const resourceOwnershipValid = [...resources.values()].every(
    (resource) =>
      (resource.occupancy === 'free' && resource.patientId == null) ||
      (resource.occupancy !== 'free' && resource.patientId != null),
  );
  const conservationValid = arrivalsProcessed === departuresProcessed + activeCount();
  const metrics: ReplicationMetricsV2 = {
    values: {
      doorToRoom: median(doorToRoom),
      lengthOfStay: median(lengthsOfStay),
      boarderHours: boarderMinutes / 60,
      waitingPatientHours: waitingMinutes / 60,
      departures: departuresInAnalysis,
      peakCensus,
      peakWaiting,
      imagingDelay: median(imagingDelays),
    },
    arrivals: arrivalsInAnalysis,
    departuresByDisposition,
  };

  let trace: SimulationTraceV2 | undefined;
  if (options.recordTrace) {
    const finalState = copySnapshot(replayState(analysisEnd));
    checkpoints.push({
      minute: analysisEnd,
      frameIndex: traceFrames.length - 1,
      state: finalState,
    });
    trace = {
      schemaVersion: 2,
      modelVersion: 'edts-model-v2',
      traceVersion: 'trace-v2.1',
      scenarioName: scenario.name,
      scenarioDigest: shortDigest(scenario),
      seed: scenario.seed,
      replication,
      window: { startMinute: 0, endMinute: analysisEnd },
      selection:
        options.selection ??
        ({
          replication,
          distance: 0,
          algorithmVersion: 'representative-v2.1',
          pairing: 'patient',
        } as const),
      identities: blueprints
        .filter(
          (blueprint) => blueprint.arrivalMinute >= 0 || initialTracePatientIds.has(blueprint.id),
        )
        .map(
          ({
            diagnostics: _diagnostics,
            dispositionRoll: _disposition,
            exitRiskRoll: _exitRisk,
            lwbsDeadlineMinutes: _lwbsDeadline,
            ...identity
          }) => identity,
        ),
      initial: initialCheckpoint!,
      frames: traceFrames,
      checkpoints,
      finalMetrics: metrics,
      peakMinute,
    };
  }

  return {
    replication,
    metrics,
    series,
    peakMinute,
    diagnostics: {
      eventCount: processedEventCount,
      maxActivePatients,
      maxOwnedResources,
      conservationValid,
      resourceOwnershipValid,
      timestampsNondecreasing,
    },
    trace,
  };
}
