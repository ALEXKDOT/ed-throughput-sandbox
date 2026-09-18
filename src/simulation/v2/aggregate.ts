import type {
  AggregateResultV2,
  AggregateSeriesPointV2,
  ComparisonResultV2,
  IntervalValueV2,
  ReplicationSeriesPointV2,
  ReplicationSummaryV2,
  ScenarioConfigV2,
  VisualizerMetricKeyV2,
} from './types';
import { VISUALIZER_METRIC_KEYS } from './types';

function quantile(sorted: readonly number[], probability: number): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0]!;
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower]!;
  const weight = position - lower;
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

export function intervalV2(values: readonly (number | null)[]): IntervalValueV2 {
  const finite = values
    .filter((value): value is number => value != null && Number.isFinite(value))
    .sort((a, b) => a - b);
  return {
    median: quantile(finite, 0.5),
    low: quantile(finite, 0.1),
    high: quantile(finite, 0.9),
    n: finite.length,
  };
}

const SERIES_KEYS: readonly Exclude<keyof ReplicationSeriesPointV2, 'minute'>[] = [
  'census',
  'waiting',
  'overflowWaiting',
  'occupiedTreatment',
  'imagingQueue',
  'boarders',
  'departures',
];

export function aggregateReplicationsV2(
  scenario: ScenarioConfigV2,
  replications: readonly ReplicationSummaryV2[],
  elapsedMilliseconds: number,
): AggregateResultV2 {
  const metrics = Object.fromEntries(
    VISUALIZER_METRIC_KEYS.map((metric) => [
      metric,
      intervalV2(replications.map((replication) => replication.metrics.values[metric])),
    ]),
  ) as Record<VisualizerMetricKeyV2, IntervalValueV2>;
  const template = replications[0]?.series ?? [];
  const series: AggregateSeriesPointV2[] = template.map((point, index) => {
    const aggregatePoint: Partial<AggregateSeriesPointV2> = { minute: point.minute };
    for (const key of SERIES_KEYS) {
      aggregatePoint[key] = intervalV2(
        replications.map((replication) => replication.series[index]?.[key] ?? null),
      );
    }
    return aggregatePoint as AggregateSeriesPointV2;
  });
  return {
    scenario,
    algorithmVersion: 'edts-model-v2.0 | aggregate-v2.0',
    replicationCount: replications.length,
    metrics,
    series,
    elapsedMilliseconds,
  };
}

export function pairedDeltasV2(
  a: readonly ReplicationSummaryV2[],
  b: readonly ReplicationSummaryV2[],
): Record<VisualizerMetricKeyV2, IntervalValueV2> {
  if (a.length !== b.length)
    throw new Error('Paired scenarios must use the same replication count.');
  return Object.fromEntries(
    VISUALIZER_METRIC_KEYS.map((metric) => [
      metric,
      intervalV2(
        a.map((replication, index) => {
          const valueA = replication.metrics.values[metric];
          const valueB = b[index]?.metrics.values[metric];
          return valueA == null || valueB == null ? null : valueB - valueA;
        }),
      ),
    ]),
  ) as Record<VisualizerMetricKeyV2, IntervalValueV2>;
}

export function demandIsPairedV2(a: ScenarioConfigV2, b: ScenarioConfigV2): boolean {
  const arrivalInterventions = (scenario: ScenarioConfigV2) =>
    scenario.interventions
      .map((intervention) => ({
        atMinute: intervention.atMinute,
        actions: intervention.actions.filter((action) => action.kind === 'scaleArrivals'),
      }))
      .filter((intervention) => intervention.actions.length > 0);
  return (
    a.seed === b.seed &&
    a.replications === b.replications &&
    JSON.stringify(a.window) === JSON.stringify(b.window) &&
    JSON.stringify(a.demand) === JSON.stringify(b.demand) &&
    JSON.stringify(arrivalInterventions(a)) === JSON.stringify(arrivalInterventions(b))
  );
}

export function changedAssumptionsV2(a: ScenarioConfigV2, b: ScenarioConfigV2): string[] {
  const changes: string[] = [];
  if (a.seed !== b.seed) changes.push(`Master seed: ${a.seed} → ${b.seed}`);
  if (a.replications !== b.replications) {
    changes.push(`Replications: ${a.replications} → ${b.replications}`);
  }
  if (a.window.warmUpMinutes !== b.window.warmUpMinutes) {
    changes.push(`Warm-up window: ${a.window.warmUpMinutes} → ${b.window.warmUpMinutes} minutes`);
  }
  if (a.window.analysisMinutes !== b.window.analysisMinutes) {
    changes.push(
      `Analysis window: ${a.window.analysisMinutes} → ${b.window.analysisMinutes} minutes`,
    );
  }
  if (a.demand.meanArrivalsPerHour !== b.demand.meanArrivalsPerHour) {
    changes.push(
      `Average arrivals: ${a.demand.meanArrivalsPerHour.toFixed(1)} → ${b.demand.meanArrivalsPerHour.toFixed(1)} per hour`,
    );
  }
  if (JSON.stringify(a.demand.hourlyMultipliers) !== JSON.stringify(b.demand.hourlyMultipliers)) {
    changes.push('Hourly arrival pattern differs');
  }
  if (JSON.stringify(a.demand.esiMix) !== JSON.stringify(b.demand.esiMix)) {
    changes.push('ESI mix differs');
  }
  if (JSON.stringify(a.demand.arrivalModeMix) !== JSON.stringify(b.demand.arrivalModeMix)) {
    changes.push('Arrival-mode mix differs');
  }
  const capacityLabels: Record<keyof ScenarioConfigV2['capacities'], string> = {
    triageSpots: 'Triage spots',
    mainRooms: 'Main rooms',
    fastTrackSpaces: 'Fast-track spaces',
    hallwayBeds: 'Hallway spaces',
    traumaBays: 'Trauma bays',
    observationBeds: 'Observation spaces',
    behavioralHealthBeds: 'Behavioral-health spaces',
    ctScanners: 'CT scanners',
    mriScanners: 'MRI scanners',
    xrayRooms: 'X-ray rooms',
    ultrasoundRooms: 'Ultrasound rooms',
    labProcessors: 'Lab processors',
    dischargeSeats: 'Discharge seats',
    boardingBeds: 'Boarding spaces',
  };
  for (const key of Object.keys(capacityLabels) as (keyof ScenarioConfigV2['capacities'])[]) {
    if (a.capacities[key] !== b.capacities[key]) {
      changes.push(`${capacityLabels[key]}: ${a.capacities[key]} → ${b.capacities[key]}`);
    }
  }
  const durationLabels: Record<
    Exclude<keyof ScenarioConfigV2['durations'], 'treatmentMedianByEsi'>,
    string
  > = {
    triageMedian: 'Median triage time',
    reassessmentMedian: 'Median reassessment time',
    ctMedian: 'Median CT time',
    mriMedian: 'Median MRI time',
    xrayMedian: 'Median X-ray time',
    ultrasoundMedian: 'Median ultrasound time',
    labMedian: 'Median lab time',
    dischargeLoungeMedian: 'Median discharge-lounge time',
    boardingMedian: 'Median inpatient delay',
    variability: 'Service-time variability',
    globalScale: 'Care-duration scale',
  };
  for (const key of Object.keys(durationLabels) as (keyof typeof durationLabels)[]) {
    if (a.durations[key] !== b.durations[key]) {
      changes.push(`${durationLabels[key]}: ${a.durations[key]} → ${b.durations[key]}`);
    }
  }
  for (const esi of [1, 2, 3, 4, 5] as const) {
    if (a.durations.treatmentMedianByEsi[esi] !== b.durations.treatmentMedianByEsi[esi]) {
      changes.push(
        `ESI ${esi} median treatment time: ${a.durations.treatmentMedianByEsi[esi]} → ${b.durations.treatmentMedianByEsi[esi]} minutes`,
      );
    }
    if (a.admissionRates[esi] !== b.admissionRates[esi]) {
      changes.push(
        `ESI ${esi} admission probability: ${(a.admissionRates[esi] * 100).toFixed(1)}% → ${(b.admissionRates[esi] * 100).toFixed(1)}%`,
      );
    }
  }
  if (JSON.stringify(a.interventions) !== JSON.stringify(b.interventions)) {
    changes.push('Scheduled interventions differ');
  }
  return changes;
}

export function comparisonResultV2(
  a: AggregateResultV2,
  b: AggregateResultV2,
  rawA: readonly ReplicationSummaryV2[],
  rawB: readonly ReplicationSummaryV2[],
): ComparisonResultV2 {
  return {
    a,
    b,
    deltas: pairedDeltasV2(rawA, rawB),
    pairing: demandIsPairedV2(a.scenario, b.scenario) ? 'patient' : 'replicationOnly',
    changedAssumptions: changedAssumptionsV2(a.scenario, b.scenario),
  };
}
