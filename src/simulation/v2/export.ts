import type { ComparisonResultV2, VisualizerRunPayloadV2 } from './types';
import { VISUALIZER_METRIC_KEYS } from './types';

function csvCell(value: unknown): string {
  let text = value == null ? 'N/A' : String(value);
  if (/^[=+\-@]/u.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function assumptionEntries(
  value: unknown,
  prefix = '',
): { path: string; value: string | number }[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => assumptionEntries(item, `${prefix}[${index}]`));
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, item]) =>
      assumptionEntries(item, prefix ? `${prefix}.${key}` : key),
    );
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return [{ path: prefix, value: String(value) }];
  }
  return [{ path: prefix, value: 'null' }];
}

function resultRows(
  slot: 'a' | 'b',
  payload: VisualizerRunPayloadV2,
  comparison?: ComparisonResultV2,
): unknown[][] {
  const result = payload.results[slot];
  if (!result) return [];
  const trace = payload.representative.traces[slot];
  const provenance = [
    slot.toUpperCase(),
    result.scenario.name,
    result.scenario.schemaVersion,
    result.scenario.modelVersion,
    result.algorithmVersion,
    trace?.scenarioDigest ?? '',
    trace?.traceVersion ?? '',
    trace?.selection.algorithmVersion ?? '',
    trace?.selection.distance ?? '',
    result.scenario.seed,
    result.replicationCount,
    payload.representative.replication,
    payload.representative.pairing,
  ];
  const rows: unknown[][] = assumptionEntries(result.scenario).map(({ path, value }) => [
    ...provenance,
    'assumption',
    path,
    '',
    value,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
  ]);
  for (const metric of VISUALIZER_METRIC_KEYS) {
    const interval = result.metrics[metric];
    const delta = comparison?.deltas[metric];
    rows.push([
      ...provenance,
      'summary',
      metric,
      '',
      '',
      interval.median,
      interval.low,
      interval.high,
      interval.n,
      delta?.median ?? '',
      delta?.low ?? '',
      delta?.high ?? '',
    ]);
  }
  for (const point of result.series) {
    for (const metric of [
      'census',
      'waiting',
      'overflowWaiting',
      'occupiedTreatment',
      'imagingQueue',
      'boarders',
      'departures',
    ] as const) {
      const interval = point[metric];
      rows.push([
        ...provenance,
        'hourly_status',
        metric,
        point.minute,
        '',
        interval.median,
        interval.low,
        interval.high,
        interval.n,
        '',
        '',
        '',
      ]);
    }
  }
  return rows;
}

export function visualizerResultsCsv(payload: VisualizerRunPayloadV2): string {
  const header = [
    'scenario_slot',
    'scenario_name',
    'schema_version',
    'model_version',
    'algorithm_version',
    'scenario_digest',
    'trace_version',
    'selection_algorithm_version',
    'selection_distance',
    'master_seed',
    'replications',
    'representative_replication_zero_based',
    'pairing',
    'section',
    'measure',
    'minute',
    'value',
    'median',
    'p10',
    'p90',
    'valid_replications',
    'paired_delta_median_b_minus_a',
    'paired_delta_p10',
    'paired_delta_p90',
  ];
  const rows = [
    header,
    ...resultRows('a', payload, payload.comparison),
    ...resultRows('b', payload, payload.comparison),
  ];
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}
