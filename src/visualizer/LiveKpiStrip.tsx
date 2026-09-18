import type {
  AggregateResultV2,
  AggregateSeriesPointV2,
  ReplayStateV2,
  SimulationTraceV2,
} from '../simulation/v2/types';
import { formatDurationV2, formatSimulationTime } from './format';

type KpiKey =
  | 'census'
  | 'doorToRoom'
  | 'waiting'
  | 'occupiedTreatment'
  | 'imagingQueue'
  | 'boarders'
  | 'departures';

interface LiveKpiStripProps {
  minute: number;
  view: 'a' | 'b' | 'split';
  states: Partial<Record<'a' | 'b', ReplayStateV2>>;
  results: Partial<Record<'a' | 'b', AggregateResultV2>>;
  traces: Partial<Record<'a' | 'b', SimulationTraceV2>>;
  activeSlot: 'a' | 'b';
  stale: boolean;
  onJump: (minute: number) => void;
}

const KPI_DEFINITIONS: {
  key: KpiKey;
  label: string;
  series?: keyof Omit<AggregateSeriesPointV2, 'minute'>;
}[] = [
  { key: 'census', label: 'ED census', series: 'census' },
  { key: 'doorToRoom', label: 'Door to room' },
  { key: 'waiting', label: 'Waiting', series: 'waiting' },
  { key: 'occupiedTreatment', label: 'Treatment spaces', series: 'occupiedTreatment' },
  { key: 'imagingQueue', label: 'Diagnostic queue', series: 'imagingQueue' },
  { key: 'boarders', label: 'Boarders', series: 'boarders' },
  { key: 'departures', label: 'Departures', series: 'departures' },
];

function valueFor(key: KpiKey, state?: ReplayStateV2): string {
  if (!state) return '—';
  if (key === 'doorToRoom') return formatDurationV2(state.live.medianDoorToRoom);
  if (key === 'waiting') return String(state.live.waiting);
  if (key === 'occupiedTreatment') {
    return `${state.live.occupiedTreatment}/${state.live.treatmentCapacity}`;
  }
  return String(state.live[key]);
}

function ensembleRange(
  definition: (typeof KPI_DEFINITIONS)[number],
  result: AggregateResultV2 | undefined,
  minute: number,
): string {
  if (!result) return 'Run for ensemble range';
  if (definition.key === 'doorToRoom') {
    const interval = result.metrics.doorToRoom;
    return `${formatDurationV2(interval.low)}–${formatDurationV2(interval.high)}`;
  }
  const point = definition.series
    ? result.series.reduce((best, candidate) =>
        Math.abs(candidate.minute - minute) < Math.abs(best.minute - minute) ? candidate : best,
      )
    : undefined;
  const interval = point && definition.series ? point[definition.series] : undefined;
  if (!interval || interval.low == null || interval.high == null) return 'Range unavailable';
  return `${Math.round(interval.low)}–${Math.round(interval.high)}`;
}

function peakMinute(
  definition: (typeof KPI_DEFINITIONS)[number],
  result: AggregateResultV2 | undefined,
  trace: SimulationTraceV2 | undefined,
): number {
  if (!result || !definition.series) return trace?.peakMinute ?? 0;
  return result.series.reduce(
    (best, candidate) =>
      (candidate[definition.series!].median ?? -Infinity) >
      (best[definition.series!].median ?? -Infinity)
        ? candidate
        : best,
    result.series[0]!,
  ).minute;
}

export function LiveKpiStrip({
  minute,
  view,
  states,
  results,
  traces,
  activeSlot,
  stale,
  onJump,
}: LiveKpiStripProps) {
  const slots: ('a' | 'b')[] = view === 'split' ? ['a', 'b'] : [view];
  const primary = view === 'split' ? activeSlot : view;
  return (
    <section className="live-kpi-section" aria-labelledby="live-kpi-title">
      <div className="live-kpi-heading">
        <div>
          <span className="section-kicker">Representative trajectory</span>
          <h2 id="live-kpi-title">
            System at {formatSimulationTime(minute, traces[primary]?.window.endMinute).compact}
          </h2>
        </div>
        <p>
          Primary values are this replay. Small ranges are the 10th–90th percentile across
          replications.
        </p>
      </div>
      <div className="live-kpi-grid">
        {KPI_DEFINITIONS.map((definition) => (
          <button
            type="button"
            className="live-kpi-card"
            key={definition.key}
            disabled={!results[primary] || stale}
            onClick={() => onJump(peakMinute(definition, results[primary], traces[primary]))}
          >
            <span>{definition.label}</span>
            <strong>
              {slots.map((slot, index) => (
                <span key={slot}>
                  {view === 'split' && <small>{slot.toUpperCase()}</small>}
                  {valueFor(definition.key, states[slot])}
                  {index < slots.length - 1 && <i aria-hidden="true">/</i>}
                </span>
              ))}
            </strong>
            <small>
              {slots
                .map(
                  (slot) =>
                    `${view === 'split' ? `${slot.toUpperCase()} ` : ''}${ensembleRange(
                      definition,
                      results[slot],
                      minute,
                    )}`,
                )
                .join(' · ')}
            </small>
          </button>
        ))}
      </div>
    </section>
  );
}
