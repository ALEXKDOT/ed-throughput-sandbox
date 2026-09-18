import { describe, expect, it } from 'vitest';
import {
  aggregateReplicationsV2,
  changedAssumptionsV2,
  demandIsPairedV2,
  pairedDeltasV2,
} from '../simulation/v2/aggregate';
import { diagnosticCapacityEstimatesV2 } from '../simulation/v2/capacityAnalysis';
import { DEFAULT_VISUALIZER_SCENARIO, cloneVisualizerScenario } from '../simulation/v2/defaults';
import { generatePatientBlueprintsV2, runReplicationV2 } from '../simulation/v2/engine';
import { visualizerResultsCsv } from '../simulation/v2/export';
import { sampleServiceMinutes } from '../simulation/v2/random';
import { snapshotAtV2 } from '../simulation/v2/replay';
import { selectRepresentativeV2 } from '../simulation/v2/representative';
import { sharedRunSettingsErrorV2, validateScenarioV2 } from '../simulation/v2/validation';
import { formatSimulationTime } from '../visualizer/format';

function shortScenario() {
  const scenario = cloneVisualizerScenario(DEFAULT_VISUALIZER_SCENARIO);
  scenario.replications = 10;
  scenario.window = { warmUpMinutes: 6 * 60, analysisMinutes: 24 * 60 };
  scenario.seed = 8_675_309;
  return scenario;
}

describe('model v2 engine', () => {
  it('is deterministic and conserves patients and resource ownership', () => {
    const scenario = shortScenario();
    const first = runReplicationV2(scenario, 0);
    const second = runReplicationV2(scenario, 0);
    expect(second).toEqual(first);
    expect(first.metrics.arrivals).toBeGreaterThan(0);
    expect(first.metrics.values.departures).toBeGreaterThan(0);
    expect(first.diagnostics.conservationValid).toBe(true);
    expect(first.diagnostics.resourceOwnershipValid).toBe(true);
    expect(first.diagnostics.timestampsNondecreasing).toBe(true);
  });

  it('records treatment reservations while patients use imaging', () => {
    const result = runReplicationV2(shortScenario(), 1, { recordTrace: true });
    const trace = result.trace!;
    const hasReservedTreatmentSpace = trace.frames.some((frame) =>
      frame.patches.some(
        (patch) =>
          patch.kind === 'upsertResource' &&
          ['mainRoom', 'fastTrackSpace', 'hallwayBed', 'traumaBay'].includes(patch.resource.kind) &&
          patch.resource.state === 'reserved',
      ),
    );
    expect(hasReservedTreatmentSpace).toBe(true);
  });

  it('reconstructs the exact final replay state after arbitrary seeks', () => {
    const result = runReplicationV2(shortScenario(), 2, { recordTrace: true });
    const trace = result.trace!;
    const middle = snapshotAtV2(trace, trace.window.endMinute / 2);
    const earlier = snapshotAtV2(trace, trace.window.endMinute / 3);
    const finalAfterRewind = snapshotAtV2(trace, trace.window.endMinute);
    expect(middle.minute).toBe(trace.window.endMinute / 2);
    expect(earlier.minute).toBe(trace.window.endMinute / 3);
    expect(finalAfterRewind).toEqual(trace.checkpoints.at(-1)!.state);
  });

  it('selects a deterministic representative replication', () => {
    const scenario = shortScenario();
    const runs = Array.from({ length: 4 }, (_, replication) =>
      runReplicationV2(scenario, replication),
    );
    expect(selectRepresentativeV2(runs)).toEqual(selectRepresentativeV2(runs));
  });

  it('preserves patient blueprints when only operational capacity changes', () => {
    const baseline = shortScenario();
    const intervention = cloneVisualizerScenario(baseline);
    intervention.capacities.ctScanners += 1;
    expect(generatePatientBlueprintsV2(intervention, 3)).toEqual(
      generatePatientBlueprintsV2(baseline, 3),
    );
    expect(demandIsPairedV2(baseline, intervention)).toBe(true);
  });

  it('produces exact zero paired deltas for identical scenarios', () => {
    const scenario = shortScenario();
    const runs = Array.from({ length: 3 }, (_, replication) =>
      runReplicationV2(scenario, replication),
    );
    const aggregate = aggregateReplicationsV2(scenario, runs, 0);
    expect(aggregate.replicationCount).toBe(3);
    for (const delta of Object.values(pairedDeltasV2(runs, runs))) {
      expect(delta.median).toBe(0);
      expect(delta.low).toBe(0);
      expect(delta.high).toBe(0);
    }
  });

  it('moves admitted patients to off-room boarding resources and releases treatment capacity', () => {
    const scenario = shortScenario();
    scenario.admissionRates = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 };
    const trace = runReplicationV2(scenario, 4, { recordTrace: true }).trace!;
    const boardingFrame = trace.frames.find((frame) =>
      frame.events.some((event) => event.kind === 'boardingStart'),
    );
    expect(boardingFrame).toBeDefined();
    expect(
      boardingFrame?.patches.some(
        (patch) =>
          patch.kind === 'upsertResource' &&
          patch.resource.kind === 'boardingBed' &&
          patch.resource.state === 'occupied',
      ),
    ).toBe(true);
  });

  it('applies a scheduled capacity addition at its stable event boundary', () => {
    const scenario = shortScenario();
    scenario.interventions = [
      {
        id: 'add-ct',
        label: 'Open second CT',
        atMinute: 300,
        actions: [{ kind: 'addCapacity', capacity: 'ctScanners', count: 1 }],
      },
    ];
    const trace = runReplicationV2(scenario, 5, { recordTrace: true }).trace!;
    const before = snapshotAtV2(trace, 299.9);
    const after = snapshotAtV2(trace, 300);
    expect(
      Object.values(before.resources).filter((resource) => resource.kind === 'ctScanner'),
    ).toHaveLength(scenario.capacities.ctScanners);
    expect(
      Object.values(after.resources).filter((resource) => resource.kind === 'ctScanner'),
    ).toHaveLength(scenario.capacities.ctScanners + 1);
  });

  it('completes the full representative-week horizon without a patient-display ceiling', () => {
    const result = runReplicationV2(DEFAULT_VISUALIZER_SCENARIO, 0);
    expect(result.series.at(-1)?.minute).toBe(7 * 24 * 60);
    expect(result.diagnostics.maxActivePatients).toBeGreaterThan(0);
    expect(result.diagnostics.conservationValid).toBe(true);
  });

  it('ships a baseline whose diagnostic capacity does not create a runaway waiting queue', () => {
    const result = runReplicationV2(DEFAULT_VISUALIZER_SCENARIO, 31);
    const final = result.series.at(-1)!;
    expect(final.waiting).toBeLessThan(50);
    expect(result.metrics.values.departures).toBeGreaterThan(result.metrics.arrivals * 0.9);

    const loads = diagnosticCapacityEstimatesV2(DEFAULT_VISUALIZER_SCENARIO);
    expect(loads.find((load) => load.key === 'lab')!.utilization).toBeLessThan(0.85);
    expect(loads.find((load) => load.key === 'ct')!.utilization).toBeLessThan(0.85);
  });

  it('flags the former two-processor lab baseline as structurally overloaded', () => {
    const unstable = cloneVisualizerScenario(DEFAULT_VISUALIZER_SCENARIO);
    unstable.capacities.labProcessors = 2;
    const lab = diagnosticCapacityEstimatesV2(unstable).find((load) => load.key === 'lab')!;
    expect(lab.utilization).toBeGreaterThan(1);
    expect(lab.pressure).toBe('overloaded');
  });

  it('uses configurable pathway-specific diagnostic probabilities', () => {
    const noLabs = shortScenario();
    const allLabs = cloneVisualizerScenario(noLabs);
    for (const pathway of ['minorInjury', 'medical', 'abdominal', 'behavioralHealth'] as const) {
      noLabs.diagnosticProbabilities.labByPathway[pathway] = 0;
      allLabs.diagnosticProbabilities.labByPathway[pathway] = 1;
    }
    const without = generatePatientBlueprintsV2(noLabs, 0);
    const withLabs = generatePatientBlueprintsV2(allLabs, 0);
    expect(without.every((patient) => !patient.diagnostics.includes('lab'))).toBe(true);
    expect(withLabs.every((patient) => patient.diagnostics.includes('lab'))).toBe(true);
  });

  it('applies pathway-specific initial-treatment multipliers', () => {
    const baseline = shortScenario();
    const slower = cloneVisualizerScenario(baseline);
    for (const pathway of ['minorInjury', 'medical', 'abdominal', 'behavioralHealth'] as const) {
      slower.pathwayTreatmentMultipliers[pathway] = 2;
    }
    const baselineResult = runReplicationV2(baseline, 2);
    const slowerResult = runReplicationV2(slower, 2);
    expect(slowerResult.metrics.values.lengthOfStay).toBeGreaterThan(
      baselineResult.metrics.values.lengthOfStay!,
    );
  });

  it('lets room-blocking boarders depart when off-room boarding capacity is zero', () => {
    const scenario = shortScenario();
    scenario.capacities.boardingBeds = 0;
    scenario.admissionRates = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 };
    const result = runReplicationV2(scenario, 0);
    expect(result.metrics.departuresByDisposition.admit).toBeGreaterThan(0);
    expect(result.diagnostics.conservationValid).toBe(true);
    expect(result.diagnostics.resourceOwnershipValid).toBe(true);
  });

  it('allows an uncapped waiting queue with patients waiting longer than 12 hours', () => {
    const scenario = cloneVisualizerScenario(DEFAULT_VISUALIZER_SCENARIO);
    scenario.window = { warmUpMinutes: 0, analysisMinutes: 24 * 60 };
    scenario.demand.meanArrivalsPerHour = 12;
    scenario.demand.hourlyMultipliers = Array.from({ length: 24 }, () => 1);
    scenario.demand.esiMix = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 };
    scenario.demand.arrivalModeMix = { walkIn: 1, ambulance: 0 };
    scenario.capacities.triageSpots = 3;
    scenario.capacities.mainRooms = 1;
    scenario.capacities.fastTrackSpaces = 0;
    scenario.capacities.hallwayBeds = 0;
    scenario.capacities.behavioralHealthBeds = 0;
    scenario.durations.triageMedian = 1;
    scenario.durations.treatmentMedianByEsi = { 1: 1440, 2: 1440, 3: 1440, 4: 1440, 5: 1440 };
    scenario.admissionRates = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    const result = runReplicationV2(scenario, 0, { recordTrace: true });
    const final = snapshotAtV2(result.trace!, scenario.window.analysisMinutes);
    const queuedPatients = Object.values(final.patients).filter(
      (patient) =>
        patient.statuses.includes('awaitingTriage') || patient.statuses.includes('awaitingRoom'),
    );

    expect(final.live.waiting).toBe(queuedPatients.length);
    expect(final.live.waiting).toBeGreaterThan(100);
    expect(
      queuedPatients
        .filter((patient) => patient.statuses.includes('awaitingRoom'))
        .every((patient) => patient.locationId === 'waiting'),
    ).toBe(true);
    expect(queuedPatients.some((patient) => patient.waitMinutes >= 12 * 60)).toBe(true);
    expect(result.metrics.values.waitingPatientHours).toBeGreaterThan(0);
  });

  it('uses deterministic probability-gated LWBS deadlines instead of universal patience caps', () => {
    const scenario = cloneVisualizerScenario(DEFAULT_VISUALIZER_SCENARIO);
    scenario.window = { warmUpMinutes: 0, analysisMinutes: 14 * 24 * 60 };
    scenario.demand.meanArrivalsPerHour = 25;
    scenario.demand.hourlyMultipliers = Array.from({ length: 24 }, () => 1);
    scenario.demand.esiMix = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 };

    const blueprints = generatePatientBlueprintsV2(scenario, 0);
    const eligible = blueprints.filter((patient) => patient.lwbsDeadlineMinutes != null);
    expect(blueprints.length).toBeGreaterThan(8_000);
    expect(eligible.length / blueprints.length).toBeGreaterThan(0.14);
    expect(eligible.length / blueprints.length).toBeLessThan(0.18);
    expect(
      eligible.every(
        (patient) =>
          patient.lwbsDeadlineMinutes! >= 6 * 60 && patient.lwbsDeadlineMinutes! <= 20 * 60,
      ),
    ).toBe(true);
    expect(blueprints.some((patient) => patient.lwbsDeadlineMinutes == null)).toBe(true);
  });

  it('counts every boarder even when off-room boarding spaces are full', () => {
    const scenario = cloneVisualizerScenario(DEFAULT_VISUALIZER_SCENARIO);
    scenario.window = { warmUpMinutes: 0, analysisMinutes: 24 * 60 };
    scenario.demand.meanArrivalsPerHour = 6;
    scenario.demand.hourlyMultipliers = Array.from({ length: 24 }, () => 1);
    scenario.capacities.mainRooms = 4;
    scenario.capacities.fastTrackSpaces = 2;
    scenario.capacities.hallwayBeds = 2;
    scenario.capacities.traumaBays = 1;
    scenario.capacities.behavioralHealthBeds = 1;
    scenario.capacities.boardingBeds = 1;
    scenario.durations = {
      ...scenario.durations,
      triageMedian: 1,
      treatmentMedianByEsi: { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2 },
      reassessmentMedian: 1,
      ctMedian: 1,
      mriMedian: 1,
      xrayMedian: 1,
      ultrasoundMedian: 1,
      labMedian: 1,
      boardingMedian: 4320,
      variability: 0.05,
    };
    scenario.admissionRates = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 };

    const result = runReplicationV2(scenario, 0, { recordTrace: true });
    const final = snapshotAtV2(result.trace!, scenario.window.analysisMinutes);
    const boarders = Object.values(final.patients).filter((patient) =>
      patient.statuses.includes('admittedAwaitingBed'),
    );
    const offRoom = boarders.filter((patient) => patient.locationId === 'boarding');
    const holdingCareSpaces = boarders.filter(
      (patient) => patient.assignedTreatmentResourceId != null,
    );

    expect(final.live.boarders).toBe(boarders.length);
    expect(final.live.boarders).toBeGreaterThan(scenario.capacities.boardingBeds);
    expect(offRoom.length).toBeLessThanOrEqual(scenario.capacities.boardingBeds);
    expect(holdingCareSpaces.length).toBeGreaterThan(0);
    expect(offRoom.length + holdingCareSpaces.length).toBe(boarders.length);
  });

  it('keeps care-duration scaling separate from inpatient delay scaling', () => {
    const baseline = shortScenario();
    const slowerCare = cloneVisualizerScenario(baseline);
    slowerCare.durations.globalScale = 2;
    expect(sampleServiceMinutes(baseline, 0, 12, 3, 'boarding')).toBe(
      sampleServiceMinutes(slowerCare, 0, 12, 3, 'boarding'),
    );
    expect(sampleServiceMinutes(baseline, 0, 12, 3, 'initialTreatment')).not.toBe(
      sampleServiceMinutes(slowerCare, 0, 12, 3, 'initialTreatment'),
    );

    const serviceAction = cloneVisualizerScenario(baseline);
    const boardingAction = cloneVisualizerScenario(baseline);
    serviceAction.interventions = [
      {
        id: 'service-boarding',
        label: 'Shorter inpatient delay',
        atMinute: -baseline.window.warmUpMinutes,
        actions: [{ kind: 'scaleService', service: 'boarding', multiplier: 0.5 }],
      },
    ];
    boardingAction.interventions = [
      {
        id: 'boarding-scale',
        label: 'Shorter inpatient delay',
        atMinute: -baseline.window.warmUpMinutes,
        actions: [{ kind: 'scaleBoarding', multiplier: 0.5 }],
      },
    ];
    expect(runReplicationV2(serviceAction, 1).metrics).toEqual(
      runReplicationV2(boardingAction, 1).metrics,
    );
  });

  it('preserves the arrival stream before an intervention and treats multiplier one as a no-op', () => {
    const baseline = shortScenario();
    const changed = cloneVisualizerScenario(baseline);
    changed.interventions = [
      {
        id: 'demand-change',
        label: 'Demand change',
        atMinute: 720,
        actions: [{ kind: 'scaleArrivals', multiplier: 1.5 }],
      },
    ];
    const noOp = cloneVisualizerScenario(changed);
    noOp.interventions[0]!.actions = [{ kind: 'scaleArrivals', multiplier: 1 }];
    const baselineBlueprints = generatePatientBlueprintsV2(baseline, 2);
    expect(generatePatientBlueprintsV2(noOp, 2)).toEqual(baselineBlueprints);
    expect(
      generatePatientBlueprintsV2(changed, 2).filter((patient) => patient.arrivalMinute < 720),
    ).toEqual(baselineBlueprints.filter((patient) => patient.arrivalMinute < 720));
  });

  it('updates time-derived replay values continuously between event frames', () => {
    const trace = runReplicationV2(shortScenario(), 2, { recordTrace: true }).trace!;
    let checked = false;
    for (let index = 0; index < trace.frames.length - 1; index += 1) {
      const start = trace.frames[index]!.minute + 0.1;
      const end = Math.min(trace.frames[index + 1]!.minute - 0.1, start + 0.5);
      if (end <= start) continue;
      const first = snapshotAtV2(trace, start);
      const second = snapshotAtV2(trace, end);
      const patient = Object.values(first.patients).find(
        (candidate) => second.patients[String(candidate.id)]?.active,
      );
      if (!patient) continue;
      expect(second.patients[String(patient.id)]!.losMinutes - patient.losMinutes).toBeCloseTo(
        end - start,
      );
      checked = true;
      break;
    }
    expect(checked).toBe(true);
  });

  it('keeps displayed triage and treatment queue counts synchronized with replayed patients', () => {
    const trace = runReplicationV2(shortScenario(), 3, { recordTrace: true }).trace!;
    const treatmentKinds = new Set([
      'mainRoom',
      'fastTrackSpace',
      'hallwayBed',
      'traumaBay',
      'behavioralHealthBed',
    ]);
    for (const frame of trace.frames.filter((_, index) => index % 25 === 0)) {
      const state = snapshotAtV2(trace, frame.minute);
      const patients = Object.values(state.patients);
      const triageQueue = patients.filter((patient) =>
        patient.statuses.includes('awaitingTriage'),
      ).length;
      const treatmentQueue = patients.filter((patient) =>
        patient.statuses.includes('awaitingRoom'),
      ).length;
      for (const resource of Object.values(state.resources)) {
        if (resource.kind === 'triageSpot') expect(resource.queueLength).toBe(triageQueue);
        if (treatmentKinds.has(resource.kind)) expect(resource.queueLength).toBe(treatmentQueue);
      }
    }
  });

  it('includes every replay-referenced patient in the identity table', () => {
    const trace = runReplicationV2(shortScenario(), 4, { recordTrace: true }).trace!;
    const referenced = new Set<number>(
      Object.keys(trace.initial.state.patients).map((patientId) => Number(patientId)),
    );
    for (const frame of trace.frames) {
      for (const event of frame.events)
        if (event.patientId != null) referenced.add(event.patientId);
      for (const patch of frame.patches) {
        if (patch.kind === 'upsertPatient') referenced.add(patch.patient.id);
        if (patch.kind === 'removePatient') referenced.add(patch.patientId);
      }
    }
    const identities = new Set(trace.identities.map((identity) => identity.id));
    expect(identities.size).toBe(trace.identities.length);
    for (const patientId of referenced) expect(identities.has(patientId)).toBe(true);
  });

  it('includes the analysis-start state when calculating peaks', () => {
    const result = runReplicationV2(shortScenario(), 5, { recordTrace: true });
    expect(result.metrics.values.peakCensus).toBeGreaterThanOrEqual(
      result.trace!.initial.state.live.census,
    );
    expect(result.metrics.values.peakWaiting).toBeGreaterThanOrEqual(
      result.trace!.initial.state.live.waiting,
    );
  });
});

describe('model v2 validation', () => {
  it('accepts the default scenario and rejects a non-normalized ESI mix', () => {
    const scenario = shortScenario();
    expect(validateScenarioV2(scenario).ok).toBe(true);
    scenario.demand.esiMix[1] = 0.5;
    expect(validateScenarioV2(scenario)).toMatchObject({ ok: false });
  });

  it('migrates saved schema-v2 scenarios that predate advanced assumptions', () => {
    const legacy = structuredClone(shortScenario()) as unknown as Record<string, unknown>;
    delete legacy.pathwayTreatmentMultipliers;
    delete legacy.diagnosticProbabilities;
    const validated = validateScenarioV2(legacy);
    expect(validated.ok).toBe(true);
    if (validated.ok) {
      expect(validated.value.pathwayTreatmentMultipliers.medical).toBe(1);
      expect(validated.value.diagnosticProbabilities.labByPathway.medical).toBe(0.7);
      expect(validated.value.capacities.ctScanners).toBe(2);
      expect(validated.value.capacities.labProcessors).toBe(4);
    }
  });

  it('rejects incomplete objects and reconstructs known fields only', () => {
    expect(validateScenarioV2({ schemaVersion: 2 })).toMatchObject({ ok: false });
    const candidate = {
      ...shortScenario(),
      unexpected: '<script>not part of the schema</script>',
      demand: { ...shortScenario().demand, ignored: true },
    };
    const validated = validateScenarioV2(candidate);
    expect(validated.ok).toBe(true);
    if (validated.ok) {
      expect(validated.value).not.toHaveProperty('unexpected');
      expect(validated.value.demand).not.toHaveProperty('ignored');
    }
  });

  it('validates the advanced timing and diagnostic assumptions', () => {
    const invalidProbability = shortScenario();
    invalidProbability.diagnosticProbabilities.ctAbdominal = 1.1;
    expect(validateScenarioV2(invalidProbability)).toMatchObject({ ok: false });

    const invalidMultiplier = shortScenario();
    invalidMultiplier.pathwayTreatmentMultipliers.behavioralHealth = 4.1;
    expect(validateScenarioV2(invalidMultiplier)).toMatchObject({ ok: false });
  });

  it('rejects unreachable resources, terminal interventions, and cumulative limit bypasses', () => {
    const zeroMri = shortScenario();
    zeroMri.capacities.mriScanners = 0;
    expect(validateScenarioV2(zeroMri)).toMatchObject({ ok: false });

    const observation = shortScenario();
    observation.capacities.observationBeds = 1;
    expect(validateScenarioV2(observation)).toMatchObject({ ok: false });

    const terminal = shortScenario();
    terminal.interventions = [
      {
        id: 'too-late',
        label: 'Too late',
        atMinute: terminal.window.analysisMinutes,
        actions: [{ kind: 'addCapacity', capacity: 'ctScanners', count: 1 }],
      },
    ];
    expect(validateScenarioV2(terminal)).toMatchObject({ ok: false });

    const excessCapacity = shortScenario();
    excessCapacity.interventions = [0, 1].map((index) => ({
      id: `capacity-${index}`,
      label: `Capacity ${index}`,
      atMinute: index,
      actions: [{ kind: 'addCapacity' as const, capacity: 'mainRooms' as const, count: 40 }],
    }));
    expect(validateScenarioV2(excessCapacity)).toMatchObject({ ok: false });

    const excessScale = shortScenario();
    excessScale.interventions = [0, 1].map((index) => ({
      id: `scale-${index}`,
      label: `Scale ${index}`,
      atMinute: index,
      actions: [{ kind: 'scaleArrivals' as const, multiplier: 5 }],
    }));
    expect(validateScenarioV2(excessScale)).toMatchObject({ ok: false });
  });

  it('enforces shared paired-run settings and inventories every assumption family', () => {
    const baseline = shortScenario();
    const changed = cloneVisualizerScenario(baseline);
    changed.window.analysisMinutes += 60;
    expect(sharedRunSettingsErrorV2(baseline, changed)).toContain('windows');
    expect(demandIsPairedV2(baseline, changed)).toBe(false);

    changed.window = { ...baseline.window };
    changed.demand.hourlyMultipliers[0] = changed.demand.hourlyMultipliers[0]! + 0.1;
    changed.demand.esiMix = { ...changed.demand.esiMix, 3: 0.3, 4: 0.22 };
    changed.demand.arrivalModeMix = { walkIn: 0.7, ambulance: 0.3 };
    changed.capacities.mriScanners += 1;
    changed.durations.mriMedian += 5;
    changed.durations.treatmentMedianByEsi[2] += 5;
    changed.admissionRates[3] += 0.01;
    changed.pathwayTreatmentMultipliers.abdominal = 1.2;
    changed.diagnosticProbabilities.ctAbdominal = 0.6;
    const changes = changedAssumptionsV2(baseline, changed).join('\n');
    expect(changes).toContain('Hourly arrival pattern');
    expect(changes).toContain('ESI mix');
    expect(changes).toContain('Arrival-mode mix');
    expect(changes).toContain('MRI scanners');
    expect(changes).toContain('Median MRI time');
    expect(changes).toContain('ESI 2 median treatment time');
    expect(changes).toContain('ESI 3 admission probability');
    expect(changes).toContain('Pathway treatment-time assumptions');
    expect(changes).toContain('Diagnostic-order probabilities');
  });

  it('formats the simulation endpoint without wrapping back to day one', () => {
    expect(formatSimulationTime(0, 10_080)).toMatchObject({ day: 'Monday', dayNumber: 1 });
    expect(formatSimulationTime(10_079, 10_080)).toMatchObject({
      day: 'Sunday',
      dayNumber: 7,
      clock: '11:59 PM',
    });
    expect(formatSimulationTime(10_080, 10_080)).toMatchObject({
      day: 'Sunday',
      dayNumber: 7,
      clock: 'Complete',
      complete: true,
    });
  });

  it('exports scenario, trace, and representative-selection provenance', () => {
    const scenario = shortScenario();
    const run = runReplicationV2(scenario, 0, { recordTrace: true });
    const result = aggregateReplicationsV2(scenario, [run], 1);
    const csv = visualizerResultsCsv({
      results: { a: result },
      representative: {
        replication: 0,
        pairing: 'patient',
        traces: { a: run.trace },
      },
    });
    expect(csv).toContain('scenario_digest');
    expect(csv).toContain('selection_algorithm_version');
    expect(csv).toContain('demand.meanArrivalsPerHour');
    expect(csv).toContain('waitingPatientHours');
    expect(csv).toContain(run.trace!.scenarioDigest);
  });
});
