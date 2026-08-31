import type { AggregateResult, ScenarioBundle } from '../simulation/types';
import { parseBundle } from '../simulation/validation';
import { METRIC_DEFINITIONS } from './format';

const URL_LIMIT = 16_000;

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function fromBase64Url(value: string): string {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

export function encodeBundle(bundle: ScenarioBundle): string {
  return toBase64Url(
    JSON.stringify({
      schemaVersion: 1,
      scenarios: bundle.scenarios,
      activeScenario: bundle.activeScenario,
    }),
  );
}

export function decodeBundle(value: string) {
  if (value.length > URL_LIMIT)
    return { ok: false as const, error: 'Shared scenario link is too large.' };
  try {
    return parseBundle(fromBase64Url(value));
  } catch {
    return { ok: false as const, error: 'Shared scenario link is malformed.' };
  }
}

export function downloadText(filename: string, text: string, mimeType: string): void {
  const blob = new Blob([text], { type: mimeType });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

function csvCell(value: unknown): string {
  let text = value == null ? 'N/A' : String(value);
  if (/^[=+\-@]/u.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

const METRIC_COHORTS: Record<keyof typeof METRIC_DEFINITIONS, string> = {
  arrivals: 'arrival event occurs in analysis window',
  departures: 'departure event occurs in analysis window',
  waitingEnd: 'state at analysis-window end',
  occupiedEnd: 'state at analysis-window end',
  medianWait: 'treatment start occurs in analysis window',
  p90Wait: 'treatment start occurs in analysis window',
  medianLos: 'departure occurs in analysis window',
  dischargedLos: 'discharged departure occurs in analysis window',
  admittedLos: 'admitted departure occurs in analysis window',
  averageOccupied: 'time-weighted system state during analysis window',
  peakOccupied: 'system state during analysis window',
  highOccupancyTime: 'time-weighted system state during analysis window',
  peakQueue: 'system state during analysis window',
  boarderHours: 'time-weighted boarding state during analysis window',
  remainingInSystem: 'state at analysis-window end',
};

export function resultsCsv(label: string, result: AggregateResult, includeHeader = true): string {
  const rows: unknown[][] = [];
  if (includeHeader) {
    rows.push([
      'scenario',
      'algorithm_version',
      'schema_version',
      'master_seed',
      'configured_replications',
      'section',
      'measure',
      'bin_start_minute',
      'bin_end_minute',
      'unit',
      'aggregation',
      'cohort_definition',
      'median',
      'p10',
      'p90',
      'valid_replications',
    ]);
  }
  const provenance = [
    label,
    result.algorithmVersion,
    result.scenario.schemaVersion,
    result.scenario.seed,
    result.scenario.replications,
  ];
  for (const [metric, value] of Object.entries(result.metrics)) {
    rows.push([
      ...provenance,
      'summary',
      metric,
      '',
      '',
      METRIC_DEFINITIONS[metric as keyof typeof METRIC_DEFINITIONS].unit,
      'per-replication metric',
      METRIC_COHORTS[metric as keyof typeof METRIC_DEFINITIONS],
      value.median,
      value.low,
      value.high,
      value.n,
    ]);
  }
  for (const tier of ['high', 'moderate', 'low'] as const) {
    for (const measure of ['median', 'p90'] as const) {
      const value = result.tierWaits[tier][measure];
      rows.push([
        ...provenance,
        'wait_by_acuity',
        `${tier}_${measure}_wait`,
        '',
        '',
        'minutes',
        measure === 'median'
          ? 'per-replication median wait'
          : 'per-replication 90th-percentile wait',
        'treatment start occurs in analysis window',
        value.median,
        value.low,
        value.high,
        value.n,
      ]);
    }
  }
  for (const point of result.status) {
    for (const measure of [
      'occupied',
      'mainOccupied',
      'fastTrackOccupied',
      'waiting',
      'boarders',
    ] as const) {
      const value = point[measure];
      rows.push([
        ...provenance,
        'system_status',
        measure,
        point.minute - 7.5,
        point.minute + 7.5,
        measure.includes('Occupied') || measure === 'occupied' ? 'spaces' : 'patients',
        'time-weighted mean',
        'state integrated within this analysis-window bin',
        value.median,
        value.low,
        value.high,
        value.n,
      ]);
    }
  }
  for (const point of result.flow15) {
    for (const measure of ['arrivals', 'departures'] as const) {
      const value = point[measure];
      rows.push([
        ...provenance,
        '15_minute_flow',
        measure,
        point.minute,
        point.minute + 15,
        'patients',
        'event count',
        `${measure.slice(0, -1)} event occurs in this analysis-window bin`,
        value.median,
        value.low,
        value.high,
        value.n,
      ]);
    }
  }
  for (const point of result.flow) {
    for (const measure of ['arrivals', 'departures'] as const) {
      const value = point[measure];
      rows.push([
        ...provenance,
        'hourly_flow',
        measure,
        point.hour * 60,
        (point.hour + 1) * 60,
        'patients',
        'hourly event count',
        `${measure.slice(0, -1)} event occurs in this analysis-window bin`,
        value.median,
        value.low,
        value.high,
        value.n,
      ]);
    }
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function stableScenarioKey(bundle: ScenarioBundle): string {
  return JSON.stringify({
    schemaVersion: 1,
    scenarios: bundle.scenarios,
    activeScenario: bundle.activeScenario,
  });
}
