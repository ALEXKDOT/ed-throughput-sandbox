import { intervalV2 } from './aggregate';
import type {
  RepresentativeSelectionV2,
  ReplicationSummaryV2,
  VisualizerMetricKeyV2,
} from './types';

const REPRESENTATIVE_METRICS: readonly VisualizerMetricKeyV2[] = [
  'doorToRoom',
  'lengthOfStay',
  'boarderHours',
  'overflowPatientHours',
  'departures',
];

function standardizedDistance(
  replication: ReplicationSummaryV2,
  reference: readonly ReplicationSummaryV2[],
): number {
  return REPRESENTATIVE_METRICS.reduce((total, metric) => {
    const interval = intervalV2(reference.map((item) => item.metrics.values[metric]));
    const value = replication.metrics.values[metric];
    if (value == null || interval.median == null) return total + 4;
    const spread = Math.max(
      1e-9,
      (interval.high ?? interval.median) - (interval.low ?? interval.median),
    );
    return total + ((value - interval.median) / spread) ** 2;
  }, 0);
}

export function selectRepresentativeV2(
  a: readonly ReplicationSummaryV2[],
  b?: readonly ReplicationSummaryV2[],
  pairing: 'patient' | 'replicationOnly' = 'patient',
): RepresentativeSelectionV2 {
  if (a.length === 0) throw new Error('At least one replication is required.');
  if (b && b.length !== a.length)
    throw new Error('Paired representative selection requires aligned runs.');
  let best = { replication: a[0]!.replication, distance: Number.POSITIVE_INFINITY };
  for (let index = 0; index < a.length; index += 1) {
    const candidateA = a[index]!;
    let distance = standardizedDistance(candidateA, a);
    if (b) distance += standardizedDistance(b[index]!, b);
    if (
      distance < best.distance ||
      (distance === best.distance && candidateA.replication < best.replication)
    ) {
      best = { replication: candidateA.replication, distance };
    }
  }
  return {
    ...best,
    algorithmVersion: 'representative-v2.0-standardized-median-distance',
    pairing,
  };
}
