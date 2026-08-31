import { quantile } from './metrics';
import { RNG_ALGORITHM_VERSION } from './random';
import { DISTRIBUTION_ALGORITHM_VERSION } from './distributions';
import {
  TIERS,
  type AcuityTier,
  type AggregateResult,
  type IntervalValue,
  type MetricKey,
  type ReplicationResult,
  type ScenarioConfig,
} from './types';

export const METRIC_KEYS: MetricKey[] = [
  'arrivals',
  'departures',
  'waitingEnd',
  'occupiedEnd',
  'medianWait',
  'p90Wait',
  'medianLos',
  'dischargedLos',
  'admittedLos',
  'averageOccupied',
  'peakOccupied',
  'highOccupancyTime',
  'peakQueue',
  'boarderHours',
  'remainingInSystem',
];

export function interval(values: readonly (number | null)[]): IntervalValue {
  const finite = values.filter((value): value is number => value != null && Number.isFinite(value));
  return {
    median: quantile(finite, 0.5),
    low: quantile(finite, 0.1),
    high: quantile(finite, 0.9),
    n: finite.length,
  };
}

export function reverseDeltaInterval(value: IntervalValue): IntervalValue {
  return {
    median: value.median == null ? null : -value.median,
    low: value.high == null ? null : -value.high,
    high: value.low == null ? null : -value.low,
    n: value.n,
  };
}

export function aggregateReplications(
  scenario: ScenarioConfig,
  replications: readonly ReplicationResult[],
  elapsedMilliseconds: number,
): AggregateResult {
  if (replications.length === 0) throw new Error('At least one replication is required.');

  const metrics = Object.fromEntries(
    METRIC_KEYS.map((key) => [key, interval(replications.map((result) => result.metrics[key]))]),
  ) as Record<MetricKey, IntervalValue>;

  const tierWaits = Object.fromEntries(
    TIERS.map((tier) => [
      tier,
      {
        median: interval(replications.map((result) => result.tierWaits[tier].median)),
        p90: interval(replications.map((result) => result.tierWaits[tier].p90)),
      },
    ]),
  ) as Record<AcuityTier, { median: IntervalValue; p90: IntervalValue }>;

  const status = replications[0]!.status.map((point, index) => ({
    minute: point.minute,
    occupied: interval(replications.map((result) => result.status[index]?.occupied ?? null)),
    mainOccupied: interval(
      replications.map((result) => result.status[index]?.mainOccupied ?? null),
    ),
    fastTrackOccupied: interval(
      replications.map((result) => result.status[index]?.fastTrackOccupied ?? null),
    ),
    waiting: interval(replications.map((result) => result.status[index]?.waiting ?? null)),
    boarders: interval(replications.map((result) => result.status[index]?.boarders ?? null)),
  }));

  const flow = replications[0]!.flow.map((point, index) => ({
    hour: point.hour,
    arrivals: interval(replications.map((result) => result.flow[index]?.arrivals ?? null)),
    departures: interval(replications.map((result) => result.flow[index]?.departures ?? null)),
  }));

  const flow15 = replications[0]!.flow15.map((point, index) => ({
    minute: point.minute,
    arrivals: interval(replications.map((result) => result.flow15[index]?.arrivals ?? null)),
    departures: interval(replications.map((result) => result.flow15[index]?.departures ?? null)),
  }));

  return {
    scenario,
    algorithmVersion: `edts-model-v1 | ${RNG_ALGORITHM_VERSION} | ${DISTRIBUTION_ALGORITHM_VERSION}`,
    replicationCount: replications.length,
    metrics,
    tierWaits,
    status,
    flow,
    flow15,
    diagnostics: {
      maxMainOccupied: Math.max(
        ...replications.map((result) => result.diagnostics.maxMainOccupied),
      ),
      maxFastTrackOccupied: Math.max(
        ...replications.map((result) => result.diagnostics.maxFastTrackOccupied),
      ),
      allTimestampsNondecreasing: replications.every(
        (result) => result.diagnostics.timestampsNondecreasing,
      ),
      allPatientTimelinesValid: replications.every(
        (result) => result.diagnostics.patientTimelinesValid,
      ),
    },
    elapsedMilliseconds,
  };
}

export function aggregatePairedDeltas(
  a: readonly ReplicationResult[],
  b: readonly ReplicationResult[],
): Record<MetricKey, IntervalValue> {
  if (
    a.length !== b.length ||
    a.some((result, index) => result.replication !== b[index]?.replication)
  ) {
    throw new Error('Paired comparisons require the same ordered replication identifiers.');
  }
  return Object.fromEntries(
    METRIC_KEYS.map((key) => [
      key,
      interval(
        a.map((result, index) => {
          const aValue = result.metrics[key];
          const bValue = b[index]?.metrics[key];
          return aValue == null || bValue == null ? null : bValue - aValue;
        }),
      ),
    ]),
  ) as Record<MetricKey, IntervalValue>;
}

export function aggregatePairedPercentDeltas(
  a: readonly ReplicationResult[],
  b: readonly ReplicationResult[],
): Record<MetricKey, IntervalValue> {
  if (
    a.length !== b.length ||
    a.some((result, index) => result.replication !== b[index]?.replication)
  ) {
    throw new Error('Paired comparisons require the same ordered replication identifiers.');
  }
  return Object.fromEntries(
    METRIC_KEYS.map((key) => [
      key,
      interval(
        a.map((result, index) => {
          const aValue = result.metrics[key];
          const bValue = b[index]?.metrics[key];
          return aValue == null || bValue == null || aValue === 0
            ? null
            : ((bValue - aValue) / aValue) * 100;
        }),
      ),
    ]),
  ) as Record<MetricKey, IntervalValue>;
}
