import type { MetricKey } from '../simulation/types';

export interface MetricDefinition {
  label: string;
  shortLabel: string;
  unit: 'count' | 'minutes' | 'hours' | 'percent' | 'spaces';
  description: string;
}

export const METRIC_DEFINITIONS: Record<MetricKey, MetricDefinition> = {
  arrivals: {
    label: 'Arrivals during analysis',
    shortLabel: 'Arrivals',
    unit: 'count',
    description: 'Synthetic arrivals occurring in the 24-hour analysis window.',
  },
  departures: {
    label: 'Departures per 24 hours',
    shortLabel: 'Departures',
    unit: 'count',
    description: 'Synthetic departures occurring in the analysis window.',
  },
  waitingEnd: {
    label: 'Still waiting at 24 hours',
    shortLabel: 'Waiting at end',
    unit: 'count',
    description: 'Patients in the treatment-space queue when the analysis window ends.',
  },
  occupiedEnd: {
    label: 'Still occupying a space',
    shortLabel: 'Occupying at end',
    unit: 'count',
    description: 'Patients in treatment or boarding when the analysis window ends.',
  },
  medianWait: {
    label: 'Median wait for a treatment space',
    shortLabel: 'Median wait',
    unit: 'minutes',
    description: 'Wait from arrival until an eligible treatment space becomes available.',
  },
  p90Wait: {
    label: '90th-percentile wait',
    shortLabel: '90th-percentile wait',
    unit: 'minutes',
    description: 'The 90th percentile of waits for a treatment space within each replication.',
  },
  medianLos: {
    label: 'Median ED length of stay',
    shortLabel: 'Median length of stay',
    unit: 'minutes',
    description: 'Arrival-to-departure time for departures in the analysis window.',
  },
  dischargedLos: {
    label: 'Median discharged length of stay',
    shortLabel: 'Discharged length of stay',
    unit: 'minutes',
    description: 'Arrival-to-departure time for discharged patients.',
  },
  admittedLos: {
    label: 'Median admitted length of stay',
    shortLabel: 'Admitted length of stay',
    unit: 'minutes',
    description: 'Arrival-to-departure time including the modeled boarding interval.',
  },
  averageOccupied: {
    label: 'Average occupied spaces',
    shortLabel: 'Average occupied',
    unit: 'spaces',
    description: 'Time-weighted average occupied treatment spaces.',
  },
  peakOccupied: {
    label: 'Peak occupied spaces',
    shortLabel: 'Peak occupied',
    unit: 'spaces',
    description: 'Largest number of simultaneously occupied treatment spaces.',
  },
  highOccupancyTime: {
    label: 'Time at or above 90% occupancy',
    shortLabel: 'High-occupancy time',
    unit: 'percent',
    description: 'Share of analysis time with at least 90% of treatment spaces occupied.',
  },
  peakQueue: {
    label: 'Peak queue length',
    shortLabel: 'Peak queue',
    unit: 'count',
    description: 'Largest number waiting for a treatment space.',
  },
  boarderHours: {
    label: 'Total boarder-hours',
    shortLabel: 'Boarder-hours',
    unit: 'hours',
    description: 'Time-integral of admitted patients occupying ED treatment spaces while boarding.',
  },
  remainingInSystem: {
    label: 'Patients remaining in system',
    shortLabel: 'Remaining in system',
    unit: 'count',
    description: 'Patients waiting or occupying a treatment space at analysis end.',
  },
};

export function formatNumber(value: number | null, unit: MetricDefinition['unit']): string {
  if (value == null || !Number.isFinite(value)) return 'N/A';
  if (unit === 'minutes') {
    if (value >= 120) return `${(value / 60).toFixed(value >= 600 ? 0 : 1)} hr`;
    return `${Math.round(value)} min`;
  }
  if (unit === 'hours') return `${value.toFixed(value >= 100 ? 0 : 1)} hr`;
  if (unit === 'percent') return `${value.toFixed(1)}%`;
  if (unit === 'spaces') return `${value.toFixed(1)} spaces`;
  return Math.round(value).toLocaleString();
}

export function formatDelta(value: number | null, unit: MetricDefinition['unit']): string {
  if (value == null || !Number.isFinite(value)) return 'N/A';
  const sign = value > 0 ? '+' : '';
  if (unit === 'minutes') return `${sign}${Math.round(value)} min`;
  if (unit === 'hours') return `${sign}${value.toFixed(1)} hr`;
  if (unit === 'percent') return `${sign}${value.toFixed(1)} pp`;
  if (unit === 'spaces') return `${sign}${value.toFixed(1)} spaces`;
  return `${sign}${Math.round(value)}`;
}

export function formatClockHour(hour: number): string {
  const normalized = ((hour % 24) + 24) % 24;
  if (normalized === 0) return '12 AM';
  if (normalized === 12) return '12 PM';
  return `${normalized % 12} ${normalized < 12 ? 'AM' : 'PM'}`;
}
