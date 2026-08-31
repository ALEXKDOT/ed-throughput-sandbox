import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { cloneScenario, DEFAULT_SCENARIO } from '../presets/scenarios';
import { runReplication } from '../simulation/engine';
import type { ScenarioConfig } from '../simulation/types';

function base(overrides: Partial<ScenarioConfig> = {}): ScenarioConfig {
  return {
    ...cloneScenario(DEFAULT_SCENARIO),
    ...overrides,
    fastTrack: { ...DEFAULT_SCENARIO.fastTrack, ...overrides.fastTrack },
  };
}

describe('discrete-event engine fixtures', () => {
  it.each([
    ['capacity', { totalSpaces: 24.5 }],
    ['replication count', { replications: 20.5 }],
    ['seed', { seed: 1.5 }],
  ])('rejects a fractional %s before simulation', (_label, override) => {
    expect(() => runReplication(base(override), 0)).toThrow(/integers/u);
  });

  it('zero arrivals produce zero queue, occupancy, and departures', () => {
    const result = runReplication(base({ arrivalRate: 0 }), 0, {
      warmUpMinutes: 0,
      analysisMinutes: 60,
    });
    expect(result.metrics).toMatchObject({
      arrivals: 0,
      departures: 0,
      waitingEnd: 0,
      occupiedEnd: 0,
      averageOccupied: 0,
      peakQueue: 0,
      boarderHours: 0,
    });
    expect(result.metrics.medianWait).toBeNull();
    expect(result.metrics.medianLos).toBeNull();
  });

  it('one patient and one space produce known event times and discharged LOS decomposition', () => {
    const result = runReplication(base({ totalSpaces: 1 }), 0, {
      includePatients: true,
      warmUpMinutes: 0,
      analysisMinutes: 60,
      fixturePatients: [
        {
          arrivalTime: 10,
          acuity: 'moderate',
          treatmentMinutes: 20,
          admitted: false,
          boardingMinutes: 0,
        },
      ],
    });
    expect(result.patients?.[0]).toMatchObject({
      arrivalTime: 10,
      treatmentStartTime: 10,
      treatmentCompletionTime: 30,
      departureTime: 30,
    });
    expect(result.metrics.medianWait).toBe(0);
    expect(result.metrics.medianLos).toBe(20);
    expect(result.metrics.dischargedLos).toBe(20);
  });

  it('admitted LOS equals wait plus treatment plus boarding and boarding retains the space', () => {
    const result = runReplication(base({ totalSpaces: 1 }), 0, {
      includePatients: true,
      warmUpMinutes: 0,
      analysisMinutes: 90,
      fixturePatients: [
        {
          arrivalTime: 0,
          acuity: 'high',
          treatmentMinutes: 10,
          admitted: true,
          boardingMinutes: 20,
        },
        {
          arrivalTime: 0,
          acuity: 'moderate',
          treatmentMinutes: 5,
          admitted: false,
          boardingMinutes: 0,
        },
      ],
    });
    const [admitted, waiting] = result.patients!;
    expect(admitted?.departureTime).toBe(30);
    expect(admitted).toBeDefined();
    expect(admitted!.departureTime! - admitted!.arrivalTime).toBe(10 + 20);
    expect(waiting?.treatmentStartTime).toBe(30);
    expect(result.metrics.admittedLos).toBe(30);
    expect(result.diagnostics.maxMainOccupied).toBe(1);
  });

  it('boarding median zero bypasses boarding and releases exactly once', () => {
    const scenario = base({ totalSpaces: 1, boardingMedianMinutes: 0 });
    scenario.admissionRates = { high: 0.9, moderate: 0.6, low: 0.2 };
    const result = runReplication(scenario, 0, {
      includePatients: true,
      warmUpMinutes: 0,
      analysisMinutes: 30,
      fixturePatients: [
        {
          arrivalTime: 0,
          acuity: 'high',
          treatmentMinutes: 10,
          admitted: true,
          boardingMinutes: 0,
        },
      ],
    });
    expect(result.patients?.[0]?.boardingCompletionTime).toBe(10);
    expect(result.patients?.[0]?.departureTime).toBe(10);
    expect(result.metrics.boarderHours).toBe(0);
    expect(result.metrics.occupiedEnd).toBe(0);
  });

  it('shorter boarding cannot prolong the same admitted patient occupancy', () => {
    const runWithBoarding = (boardingMinutes: number) =>
      runReplication(base({ totalSpaces: 1 }), 0, {
        includePatients: true,
        warmUpMinutes: 0,
        analysisMinutes: 120,
        fixturePatients: [
          {
            arrivalTime: 0,
            acuity: 'high',
            treatmentMinutes: 10,
            admitted: true,
            boardingMinutes,
          },
          {
            arrivalTime: 1,
            acuity: 'moderate',
            treatmentMinutes: 5,
            admitted: false,
            boardingMinutes: 0,
          },
        ],
      });

    const shorter = runWithBoarding(10);
    const longer = runWithBoarding(40);

    expect(shorter.patients?.[0]?.departureTime).toBe(20);
    expect(longer.patients?.[0]?.departureTime).toBe(50);
    expect(shorter.patients?.[0]?.departureTime).toBeLessThan(
      longer.patients?.[0]?.departureTime ?? Number.POSITIVE_INFINITY,
    );
    expect(shorter.patients?.[1]?.treatmentStartTime).toBe(20);
    expect(longer.patients?.[1]?.treatmentStartTime).toBe(50);
  });

  it('adding one main treatment space never delays a fixed patient stream', () => {
    const runWithTotalSpaces = (totalSpaces: number) =>
      runReplication(
        base({
          totalSpaces,
          fastTrack: { enabled: true, spaces: 1, medianMinutes: 60 },
        }),
        0,
        {
          includePatients: true,
          warmUpMinutes: 0,
          analysisMinutes: 120,
          fixturePatients: [0, 1, 2].map(() => ({
            arrivalTime: 0,
            acuity: 'moderate' as const,
            treatmentMinutes: 30,
            admitted: false,
            boardingMinutes: 0,
          })),
        },
      );

    const oneMainSpace = runWithTotalSpaces(2);
    const twoMainSpaces = runWithTotalSpaces(3);
    const oneMainStarts = oneMainSpace.patients!.map((patient) => patient.treatmentStartTime!);
    const twoMainStarts = twoMainSpaces.patients!.map((patient) => patient.treatmentStartTime!);

    expect(oneMainStarts).toEqual([0, 30, 60]);
    expect(twoMainStarts).toEqual([0, 0, 30]);
    for (const [index, start] of twoMainStarts.entries()) {
      expect(start).toBeLessThanOrEqual(oneMainStarts[index]!);
    }
    expect(twoMainSpaces.diagnostics.maxMainOccupied).toBe(2);
    expect(twoMainSpaces.diagnostics.maxFastTrackOccupied).toBe(0);
  });

  it('drains an inherited queue when no patients arrive during the analysis period', () => {
    const result = runReplication(base({ totalSpaces: 1 }), 0, {
      warmUpMinutes: 60,
      analysisMinutes: 60,
      fixturePatients: [0, 1, 2].map(() => ({
        arrivalTime: 50,
        acuity: 'moderate' as const,
        treatmentMinutes: 10,
        admitted: false,
        boardingMinutes: 0,
      })),
    });

    expect(result.metrics.arrivals).toBe(0);
    expect(result.flow.reduce((sum, point) => sum + point.arrivals, 0)).toBe(0);
    expect(result.metrics.waitingEnd).toBe(0);
    expect(result.status.at(-1)?.waiting).toBe(0);
    for (let index = 1; index < result.status.length; index += 1) {
      expect(result.status[index]!.waiting).toBeLessThanOrEqual(result.status[index - 1]!.waiting);
    }
  });

  it('fast track honors eligibility, allocation, main capacity, and no-idle routing', () => {
    const result = runReplication(
      base({ totalSpaces: 2, fastTrack: { enabled: true, spaces: 1, medianMinutes: 60 } }),
      0,
      {
        includePatients: true,
        warmUpMinutes: 0,
        analysisMinutes: 120,
        fixturePatients: [
          {
            arrivalTime: 0,
            acuity: 'high',
            treatmentMinutes: 20,
            admitted: false,
            boardingMinutes: 0,
          },
          {
            arrivalTime: 0,
            acuity: 'moderate',
            treatmentMinutes: 20,
            admitted: false,
            boardingMinutes: 0,
          },
          {
            arrivalTime: 0,
            acuity: 'low',
            treatmentMinutes: 20,
            admitted: false,
            boardingMinutes: 0,
          },
        ],
      },
    );
    expect(result.patients?.[0]?.spaceType).toBe('main');
    expect(result.patients?.[2]?.spaceType).toBe('fastTrack');
    expect(result.patients?.[1]?.spaceType).toBe('main');
    expect(result.patients?.[1]?.treatmentStartTime).toBe(20);
    expect(result.diagnostics.maxMainOccupied).toBeLessThanOrEqual(1);
    expect(result.diagnostics.maxFastTrackOccupied).toBeLessThanOrEqual(1);
  });

  it('enforces strict priority and FIFO within a tier', () => {
    const result = runReplication(base({ totalSpaces: 1 }), 0, {
      includePatients: true,
      warmUpMinutes: 0,
      analysisMinutes: 80,
      fixturePatients: [
        {
          arrivalTime: 0,
          acuity: 'low',
          treatmentMinutes: 10,
          admitted: false,
          boardingMinutes: 0,
        },
        {
          arrivalTime: 1,
          acuity: 'moderate',
          treatmentMinutes: 10,
          admitted: false,
          boardingMinutes: 0,
        },
        {
          arrivalTime: 2,
          acuity: 'high',
          treatmentMinutes: 10,
          admitted: false,
          boardingMinutes: 0,
        },
        {
          arrivalTime: 3,
          acuity: 'high',
          treatmentMinutes: 10,
          admitted: false,
          boardingMinutes: 0,
        },
      ],
    });
    expect(result.patients?.[2]?.treatmentStartTime).toBe(10);
    expect(result.patients?.[3]?.treatmentStartTime).toBe(20);
    expect(result.patients?.[1]?.treatmentStartTime).toBe(30);
  });

  it('batches a same-time release and arrival before priority dispatch and snapshots the left horizon limit', () => {
    const result = runReplication(base({ totalSpaces: 1 }), 0, {
      includePatients: true,
      warmUpMinutes: 0,
      analysisMinutes: 60,
      fixturePatients: [
        {
          arrivalTime: 0,
          acuity: 'low',
          treatmentMinutes: 10,
          admitted: false,
          boardingMinutes: 0,
        },
        {
          arrivalTime: 1,
          acuity: 'moderate',
          treatmentMinutes: 10,
          admitted: false,
          boardingMinutes: 0,
        },
        {
          arrivalTime: 10,
          acuity: 'high',
          treatmentMinutes: 40,
          admitted: false,
          boardingMinutes: 0,
        },
      ],
    });
    expect(result.patients?.[2]?.treatmentStartTime).toBe(10);
    expect(result.patients?.[1]?.treatmentStartTime).toBe(50);
    expect(result.metrics.occupiedEnd).toBe(1);
    expect(result.patients?.[1]?.departureTime).toBeUndefined();
  });

  it('excludes warm-up events while carrying warm-up state into analysis', () => {
    const result = runReplication(base({ totalSpaces: 1 }), 0, {
      includePatients: true,
      warmUpMinutes: 60,
      analysisMinutes: 60,
      fixturePatients: [
        {
          arrivalTime: 10,
          acuity: 'high',
          treatmentMinutes: 10,
          admitted: false,
          boardingMinutes: 0,
        },
        {
          arrivalTime: 50,
          acuity: 'moderate',
          treatmentMinutes: 30,
          admitted: false,
          boardingMinutes: 0,
        },
        {
          arrivalTime: 70,
          acuity: 'low',
          treatmentMinutes: 10,
          admitted: false,
          boardingMinutes: 0,
        },
      ],
    });
    expect(result.metrics.arrivals).toBe(1);
    expect(result.metrics.departures).toBe(2);
    expect(result.metrics.medianWait).toBe(10);
    expect(result.metrics.averageOccupied).toBeCloseTo(0.5, 10);
  });

  it('computes exact time-weighted state bins', () => {
    const result = runReplication(base({ totalSpaces: 1 }), 0, {
      warmUpMinutes: 0,
      analysisMinutes: 60,
      fixturePatients: [
        {
          arrivalTime: 0,
          acuity: 'high',
          treatmentMinutes: 30,
          admitted: false,
          boardingMinutes: 0,
        },
      ],
    });
    expect(result.metrics.averageOccupied).toBe(0.5);
    expect(result.status.map((point) => point.occupied)).toEqual([1, 1, 0, 0]);
  });

  it('reports complete 15-minute flow bins that reconcile to hourly counts', () => {
    const result = runReplication(base(), 0);
    expect(result.flow15).toHaveLength(96);
    expect(result.flow15.reduce((sum, point) => sum + point.arrivals, 0)).toBe(
      result.flow.reduce((sum, point) => sum + point.arrivals, 0),
    );
    expect(result.flow15.reduce((sum, point) => sum + point.departures, 0)).toBe(
      result.flow.reduce((sum, point) => sum + point.departures, 0),
    );
  });
});

describe('stochastic engine invariants', () => {
  it('is exactly reproducible for the same scenario and seed', () => {
    expect(runReplication(base(), 3)).toEqual(runReplication(base(), 3));
  });

  it('never exceeds configured capacities and preserves valid chronology across generated cases', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 4_294_967_295 }),
        fc.integer({ min: 5, max: 35 }),
        fc.boolean(),
        (seed, totalSpaces, fastEnabled) => {
          const fastSpaces = Math.min(4, totalSpaces - 1);
          const scenario = base({
            seed,
            totalSpaces,
            arrivalRate: 12,
            fastTrack: { enabled: fastEnabled, spaces: fastSpaces, medianMinutes: 60 },
          });
          const result = runReplication(scenario, 0);
          expect(result.diagnostics.maxMainOccupied).toBeLessThanOrEqual(
            totalSpaces - (fastEnabled ? fastSpaces : 0),
          );
          expect(result.diagnostics.maxFastTrackOccupied).toBeLessThanOrEqual(
            fastEnabled ? fastSpaces : 0,
          );
          expect(result.diagnostics.timestampsNondecreasing).toBe(true);
          expect(result.diagnostics.patientTimelinesValid).toBe(true);
          expect(
            Object.values(result.metrics).every(
              (value) => value == null || (Number.isFinite(value) && value >= 0),
            ),
          ).toBe(true);
        },
      ),
      { numRuns: 20, seed: 20260831 },
    );
  });
});
