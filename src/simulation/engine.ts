import { sampleTruncatedLognormal, TREATMENT_SIGMA, BOARDING_SIGMA } from './distributions';
import { EventQueue, type SimulationEvent } from './eventQueue';
import { median, p90 } from './metrics';
import { generatePatientStream } from './patientStream';
import {
  TIERS,
  type AcuityTier,
  type MetricKey,
  type PatientRecord,
  type ReplicationResult,
  type ScenarioConfig,
  type SpaceType,
} from './types';

export const WARM_UP_MINUTES = 24 * 60;
export const ANALYSIS_MINUTES = 24 * 60;
export const ANALYSIS_END = WARM_UP_MINUTES + ANALYSIS_MINUTES;
export const STATUS_BIN_MINUTES = 15;

interface FixturePatient {
  arrivalTime: number;
  acuity: AcuityTier;
  treatmentMinutes: number;
  admitted: boolean;
  boardingMinutes: number;
}

export interface SimulationOptions {
  includePatients?: boolean;
  fixturePatients?: FixturePatient[];
  warmUpMinutes?: number;
  analysisMinutes?: number;
}

interface RunningState {
  mainOccupied: number;
  fastOccupied: number;
  boarders: number;
  queues: Record<AcuityTier, PatientRecord[]>;
}

function totalQueued(state: RunningState): number {
  return state.queues.high.length + state.queues.moderate.length + state.queues.low.length;
}

function releaseSpace(state: RunningState, space: SpaceType | undefined): void {
  if (space === 'fastTrack') state.fastOccupied -= 1;
  if (space === 'main') state.mainOccupied -= 1;
  if (state.mainOccupied < 0 || state.fastOccupied < 0) {
    throw new Error('Simulation invariant violated: released an unoccupied treatment space.');
  }
}

export function runReplication(
  scenario: ScenarioConfig,
  replication: number,
  options: SimulationOptions = {},
): ReplicationResult {
  if (
    !Number.isInteger(scenario.totalSpaces) ||
    !Number.isInteger(scenario.fastTrack.spaces) ||
    !Number.isInteger(scenario.replications) ||
    !Number.isInteger(scenario.seed) ||
    !Number.isInteger(replication) ||
    replication < 0
  ) {
    throw new Error(
      'Simulation invariant violated: capacities, seeds, and replications are integers.',
    );
  }
  const warmUp = options.warmUpMinutes ?? WARM_UP_MINUTES;
  const analysisMinutes = options.analysisMinutes ?? ANALYSIS_MINUTES;
  const analysisEnd = warmUp + analysisMinutes;
  const mainCapacity =
    scenario.totalSpaces - (scenario.fastTrack.enabled ? scenario.fastTrack.spaces : 0);
  const fastCapacity = scenario.fastTrack.enabled ? scenario.fastTrack.spaces : 0;
  if (mainCapacity < 1 || fastCapacity < 0) throw new Error('Invalid treatment-space allocation.');

  const patients = options.fixturePatients
    ? options.fixturePatients.map<PatientRecord>((fixture, id) => ({
        id,
        arrivalTime: fixture.arrivalTime,
        queueEntryTime: fixture.arrivalTime,
        acuity: fixture.acuity,
        serviceUniform: 0.5,
        admissionUniform: fixture.admitted ? 0 : 1,
        boardingUniform: 0.5,
      }))
    : generatePatientStream(scenario, replication, analysisEnd);
  const fixtureById = options.fixturePatients;

  const state: RunningState = {
    mainOccupied: 0,
    fastOccupied: 0,
    boarders: 0,
    queues: { high: [], moderate: [], low: [] },
  };
  const queue = new EventQueue();
  let sequence = 0;
  const schedule = (event: Omit<SimulationEvent, 'sequence'>) =>
    queue.push({ ...event, sequence: sequence++ });
  for (const patient of patients) {
    schedule({ time: patient.arrivalTime, kind: 'arrival', patientId: patient.id });
  }

  const statusBinCount = Math.ceil(analysisMinutes / STATUS_BIN_MINUTES);
  const occupiedArea = Array.from({ length: statusBinCount }, () => 0);
  const mainOccupiedArea = Array.from({ length: statusBinCount }, () => 0);
  const fastTrackOccupiedArea = Array.from({ length: statusBinCount }, () => 0);
  const waitingArea = Array.from({ length: statusBinCount }, () => 0);
  const boarderArea = Array.from({ length: statusBinCount }, () => 0);
  const hourlyArrivals = Array.from({ length: 24 }, () => 0);
  const hourlyDepartures = Array.from({ length: 24 }, () => 0);
  const flow15Arrivals = Array.from({ length: statusBinCount }, () => 0);
  const flow15Departures = Array.from({ length: statusBinCount }, () => 0);
  const waits: number[] = [];
  const waitsByTier: Record<AcuityTier, number[]> = { high: [], moderate: [], low: [] };
  const lengthsOfStay: number[] = [];
  const dischargedLengths: number[] = [];
  const admittedLengths: number[] = [];
  let arrivals = 0;
  let departures = 0;
  let occupancyArea = 0;
  let highOccupancyArea = 0;
  let boarderHoursArea = 0;
  let peakOccupied = 0;
  let peakQueue = 0;
  let maxMainOccupied = 0;
  let maxFastTrackOccupied = 0;
  let lastEventTime = 0;
  let previousTimestamp = Number.NEGATIVE_INFINITY;
  let timestampsNondecreasing = true;
  let eventCount = 0;

  const occupied = () => state.mainOccupied + state.fastOccupied;

  const integrate = (from: number, to: number): void => {
    const start = Math.max(from, warmUp);
    const end = Math.min(to, analysisEnd);
    if (!(end > start)) return;
    const duration = end - start;
    const occupiedNow = occupied();
    const waitingNow = totalQueued(state);
    occupancyArea += occupiedNow * duration;
    boarderHoursArea += state.boarders * duration;
    peakOccupied = Math.max(peakOccupied, occupiedNow);
    peakQueue = Math.max(peakQueue, waitingNow);
    if (occupiedNow / scenario.totalSpaces >= 0.9) highOccupancyArea += duration;

    let cursor = start;
    while (cursor < end) {
      const bin = Math.min(statusBinCount - 1, Math.floor((cursor - warmUp) / STATUS_BIN_MINUTES));
      const binEnd = Math.min(end, warmUp + (bin + 1) * STATUS_BIN_MINUTES);
      const overlap = binEnd - cursor;
      occupiedArea[bin]! += occupiedNow * overlap;
      mainOccupiedArea[bin]! += state.mainOccupied * overlap;
      fastTrackOccupiedArea[bin]! += state.fastOccupied * overlap;
      waitingArea[bin]! += waitingNow * overlap;
      boarderArea[bin]! += state.boarders * overlap;
      cursor = binEnd;
    }
  };

  const recordDeparture = (patient: PatientRecord, time: number): void => {
    patient.departureTime = time;
    if (time >= warmUp && time < analysisEnd) {
      departures += 1;
      const hour = Math.floor((time - warmUp) / 60);
      if (hour >= 0 && hour < 24) hourlyDepartures[hour]! += 1;
      const bin = Math.floor((time - warmUp) / STATUS_BIN_MINUTES);
      if (bin >= 0 && bin < statusBinCount) flow15Departures[bin]! += 1;
      const los = time - patient.arrivalTime;
      lengthsOfStay.push(los);
      if (patient.admitted) admittedLengths.push(los);
      else dischargedLengths.push(los);
    }
  };

  const startTreatment = (patient: PatientRecord, space: SpaceType, time: number): void => {
    patient.treatmentStartTime = time;
    patient.spaceType = space;
    if (space === 'main') state.mainOccupied += 1;
    else state.fastOccupied += 1;

    if (time >= warmUp && time < analysisEnd) {
      const wait = time - patient.arrivalTime;
      waits.push(wait);
      waitsByTier[patient.acuity].push(wait);
    }

    const fixture = fixtureById?.[patient.id];
    const medianMinutes =
      space === 'fastTrack'
        ? scenario.fastTrack.medianMinutes
        : scenario.treatmentMedians[patient.acuity] * scenario.treatmentTimeScale;
    const treatmentMinutes = fixture
      ? fixture.treatmentMinutes
      : sampleTruncatedLognormal(
          medianMinutes,
          TREATMENT_SIGMA[scenario.treatmentVariability],
          5,
          1440,
          patient.serviceUniform,
        );
    schedule({
      time: time + treatmentMinutes,
      kind: 'treatmentComplete',
      patientId: patient.id,
    });
  };

  const dispatch = (time: number): void => {
    while (true) {
      if (state.mainOccupied < mainCapacity) {
        const priorityTier = TIERS.find((tier) => tier !== 'low' && state.queues[tier].length > 0);
        if (priorityTier) {
          startTreatment(state.queues[priorityTier].shift()!, 'main', time);
          continue;
        }
      }
      if (state.queues.low.length > 0 && state.fastOccupied < fastCapacity) {
        startTreatment(state.queues.low.shift()!, 'fastTrack', time);
        continue;
      }
      if (state.queues.low.length > 0 && state.mainOccupied < mainCapacity) {
        startTreatment(state.queues.low.shift()!, 'main', time);
        continue;
      }
      break;
    }
  };

  while (queue.size > 0) {
    const first = queue.pop()!;
    if (first.time >= analysisEnd) break;
    const currentTime = first.time;
    integrate(lastEventTime, currentTime);
    lastEventTime = currentTime;

    const batch = [first];
    let next = queue.pop();
    while (next && next.time === currentTime) {
      batch.push(next);
      next = queue.pop();
    }
    if (next) queue.push(next);

    for (const event of batch) {
      eventCount += 1;
      if (event.time < previousTimestamp) timestampsNondecreasing = false;
      previousTimestamp = event.time;
      const patient = event.patientId == null ? undefined : patients[event.patientId];

      if (event.kind === 'boardingComplete' && patient) {
        state.boarders -= 1;
        releaseSpace(state, patient.spaceType);
        patient.boardingCompletionTime = currentTime;
        recordDeparture(patient, currentTime);
      } else if (event.kind === 'treatmentComplete' && patient) {
        patient.treatmentCompletionTime = currentTime;
        const fixture = fixtureById?.[patient.id];
        patient.admitted = fixture
          ? fixture.admitted
          : patient.admissionUniform < scenario.admissionRates[patient.acuity];
        if (patient.admitted) {
          const boardingMinutes = fixture
            ? fixture.boardingMinutes
            : scenario.boardingMedianMinutes === 0
              ? 0
              : sampleTruncatedLognormal(
                  scenario.boardingMedianMinutes,
                  BOARDING_SIGMA,
                  1,
                  4320,
                  patient.boardingUniform,
                );
          if (boardingMinutes === 0) {
            patient.boardingCompletionTime = currentTime;
            releaseSpace(state, patient.spaceType);
            recordDeparture(patient, currentTime);
          } else {
            state.boarders += 1;
            schedule({
              time: currentTime + boardingMinutes,
              kind: 'boardingComplete',
              patientId: patient.id,
            });
          }
        } else {
          releaseSpace(state, patient.spaceType);
          recordDeparture(patient, currentTime);
        }
      } else if (event.kind === 'arrival' && patient) {
        state.queues[patient.acuity].push(patient);
        if (currentTime >= warmUp && currentTime < analysisEnd) {
          arrivals += 1;
          const hour = Math.floor((currentTime - warmUp) / 60);
          if (hour >= 0 && hour < 24) hourlyArrivals[hour]! += 1;
          const bin = Math.floor((currentTime - warmUp) / STATUS_BIN_MINUTES);
          if (bin >= 0 && bin < statusBinCount) flow15Arrivals[bin]! += 1;
        }
      }
    }

    dispatch(currentTime);
    if (currentTime >= warmUp && currentTime < analysisEnd) {
      peakOccupied = Math.max(peakOccupied, occupied());
      peakQueue = Math.max(peakQueue, totalQueued(state));
    }
    maxMainOccupied = Math.max(maxMainOccupied, state.mainOccupied);
    maxFastTrackOccupied = Math.max(maxFastTrackOccupied, state.fastOccupied);
  }

  integrate(lastEventTime, analysisEnd);
  const waitingEnd = totalQueued(state);
  const occupiedEnd = occupied();
  const patientTimelinesValid = patients.every(
    (patient) =>
      patient.arrivalTime >= 0 &&
      (patient.treatmentStartTime == null || patient.treatmentStartTime >= patient.arrivalTime) &&
      (patient.treatmentCompletionTime == null ||
        (patient.treatmentStartTime != null &&
          patient.treatmentCompletionTime >= patient.treatmentStartTime)) &&
      (patient.departureTime == null || patient.departureTime >= patient.arrivalTime),
  );

  const metrics: Record<MetricKey, number | null> = {
    arrivals,
    departures,
    waitingEnd,
    occupiedEnd,
    medianWait: median(waits),
    p90Wait: p90(waits),
    medianLos: median(lengthsOfStay),
    dischargedLos: median(dischargedLengths),
    admittedLos: median(admittedLengths),
    averageOccupied: occupancyArea / analysisMinutes,
    peakOccupied,
    highOccupancyTime: (highOccupancyArea / analysisMinutes) * 100,
    peakQueue,
    boarderHours: boarderHoursArea / 60,
    remainingInSystem: waitingEnd + occupiedEnd,
  };

  return {
    replication,
    metrics,
    tierWaits: {
      high: { median: median(waitsByTier.high), p90: p90(waitsByTier.high) },
      moderate: { median: median(waitsByTier.moderate), p90: p90(waitsByTier.moderate) },
      low: { median: median(waitsByTier.low), p90: p90(waitsByTier.low) },
    },
    status: occupiedArea.map((area, index) => {
      const binDuration = Math.min(
        STATUS_BIN_MINUTES,
        analysisMinutes - index * STATUS_BIN_MINUTES,
      );
      return {
        minute: index * STATUS_BIN_MINUTES + binDuration / 2,
        occupied: area / binDuration,
        mainOccupied: mainOccupiedArea[index]! / binDuration,
        fastTrackOccupied: fastTrackOccupiedArea[index]! / binDuration,
        waiting: waitingArea[index]! / binDuration,
        boarders: boarderArea[index]! / binDuration,
      };
    }),
    flow: hourlyArrivals.map((count, hour) => ({
      hour,
      arrivals: count,
      departures: hourlyDepartures[hour]!,
    })),
    flow15: flow15Arrivals.map((count, index) => ({
      minute: index * STATUS_BIN_MINUTES,
      arrivals: count,
      departures: flow15Departures[index]!,
    })),
    diagnostics: {
      maxMainOccupied,
      maxFastTrackOccupied,
      timestampsNondecreasing,
      patientTimelinesValid,
      eventCount,
    },
    ...(options.includePatients ? { patients } : {}),
  };
}
