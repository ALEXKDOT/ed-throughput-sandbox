import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Fragment } from 'react';
import type {
  AggregateResultV2,
  ComparisonResultV2,
  SimulationTraceV2,
  VisualizerMetricKeyV2,
} from '../simulation/v2/types';
import { VISUALIZER_METRIC_KEYS } from '../simulation/v2/types';
import { formatMetricV2, formatSimulationTime, METRIC_LABELS_V2 } from './format';

type SeriesMetric = 'census' | 'waiting' | 'boarders' | 'imagingQueue';

interface EvidencePanelProps {
  results: Partial<Record<'a' | 'b', AggregateResultV2>>;
  comparison?: ComparisonResultV2;
  view: 'a' | 'b' | 'split';
  trace?: SimulationTraceV2;
  seriesMetric: SeriesMetric;
  stale: boolean;
  onSeriesMetric: (metric: SeriesMetric) => void;
  onExport: () => void;
}

function direction(value: number | null): string {
  if (value == null) return 'N/A';
  if (Math.abs(value) < 0.05) return 'Similar';
  return value > 0 ? 'Higher' : 'Lower';
}

export function EvidencePanel({
  results,
  comparison,
  view,
  trace,
  seriesMetric,
  stale,
  onSeriesMetric,
  onExport,
}: EvidencePanelProps) {
  const slot = view === 'b' ? 'b' : 'a';
  const result = results[slot];
  if (!result) {
    return (
      <section
        className="visualizer-evidence visualizer-evidence--empty"
        aria-labelledby="visualizer-evidence"
      >
        <div>
          <span className="section-kicker">Evidence layer</span>
          <h2 id="visualizer-evidence">One replay to understand. Repeated runs to compare.</h2>
        </div>
        <p>
          Run the simulation to choose a statistically representative trajectory and calculate
          10th–90th percentile ranges across the full ensemble.
        </p>
      </section>
    );
  }

  const chartSlots: ('a' | 'b')[] = view === 'split' ? ['a', 'b'] : [slot];
  const data = result.series.map((point, index) => {
    const row: Record<string, number | [number, number] | null> = { minute: point.minute };
    for (const chartSlot of chartSlots) {
      const interval = results[chartSlot]?.series[index]?.[seriesMetric];
      row[`${chartSlot}Band`] =
        interval?.low == null || interval.high == null ? null : [interval.low, interval.high];
      row[`${chartSlot}Median`] = interval?.median ?? null;
    }
    return row;
  });
  const horizon = result.scenario.window.analysisMinutes;
  const dayTicks = Array.from({ length: Math.ceil(horizon / 1_440) + 1 }, (_, index) =>
    Math.min(index * 1_440, horizon),
  ).filter((value, index, values) => index === 0 || value !== values[index - 1]);

  return (
    <section className="visualizer-results" aria-labelledby="visualizer-evidence">
      <div className="visualizer-results-heading">
        <div>
          <span className="section-kicker">Ensemble evidence</span>
          <h2 id="visualizer-evidence">Repeated-run outcomes</h2>
          <p>
            Median and 10th–90th percentile across {result.replicationCount} replications. These
            ranges are not confidence intervals.
          </p>
        </div>
        <button className="secondary-button" type="button" disabled={stale} onClick={onExport}>
          Export comparison report (.csv)
        </button>
      </div>

      {comparison && view === 'split' && (
        <div className="comparison-experiment">
          <div>
            <strong>What changed</strong>
            {comparison.changedAssumptions.length > 0 ? (
              <ul>
                {comparison.changedAssumptions.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
            ) : (
              <p>
                No model assumptions differ. Identical scenarios should produce zero paired deltas.
              </p>
            )}
          </div>
          <p>
            {comparison.pairing === 'patient'
              ? 'Patient-level pairing: both scenarios use identical arrivals and synthetic patient attributes.'
              : 'Demand differs, so pairing is by replication only. Changes cannot be read as the isolated effect of capacity.'}
          </p>
        </div>
      )}

      <div className="visualizer-metric-grid">
        {VISUALIZER_METRIC_KEYS.map((metric: VisualizerMetricKeyV2) => {
          const interval = result.metrics[metric];
          const intervalB = results.b?.metrics[metric];
          const delta = comparison?.deltas[metric];
          return (
            <article className="visualizer-metric-card" key={metric}>
              <span>{METRIC_LABELS_V2[metric]}</span>
              {view === 'split' && intervalB ? (
                <strong className="paired-metric-values">
                  <span>
                    <b>A</b> {formatMetricV2(metric, interval.median)}
                  </span>
                  <span>
                    <b>B</b> {formatMetricV2(metric, intervalB.median)}
                  </span>
                </strong>
              ) : (
                <strong>{formatMetricV2(metric, interval.median)}</strong>
              )}
              <small>
                {view === 'split' && intervalB
                  ? `A ${formatMetricV2(metric, interval.low)}–${formatMetricV2(
                      metric,
                      interval.high,
                    )} · B ${formatMetricV2(metric, intervalB.low)}–${formatMetricV2(
                      metric,
                      intervalB.high,
                    )}`
                  : `${formatMetricV2(metric, interval.low)}–${formatMetricV2(
                      metric,
                      interval.high,
                    )}`}
              </small>
              {comparison && view === 'split' && (
                <em>
                  {direction(delta?.median ?? null)} in B · Δ{' '}
                  {formatMetricV2(metric, delta?.median ?? null)}
                </em>
              )}
            </article>
          );
        })}
      </div>

      <div className="uncertainty-panel">
        <div className="uncertainty-heading">
          <div>
            <h3>Uncertainty through the week</h3>
            <p>
              {view === 'split' ? 'A and B bands show' : 'Band shows'} the 10th–90th percentile;
              {view === 'split' ? ' lines show' : ' line shows'} the across-replication median.
            </p>
          </div>
          <label>
            Measure
            <select
              value={seriesMetric}
              onChange={(event) => onSeriesMetric(event.target.value as SeriesMetric)}
            >
              <option value="census">ED census</option>
              <option value="waiting">Waiting</option>
              <option value="boarders">Boarders</option>
              <option value="imagingQueue">Diagnostic queue</option>
            </select>
          </label>
        </div>
        <div className="uncertainty-chart" aria-label={`${seriesMetric} uncertainty over the week`}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 20, bottom: 6, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dbe4e8" />
              <XAxis
                dataKey="minute"
                type="number"
                domain={[0, horizon]}
                ticks={dayTicks}
                tickFormatter={(minute) => formatSimulationTime(Number(minute), horizon).dayShort}
              />
              <YAxis allowDecimals={false} width={36} />
              <Tooltip
                labelFormatter={(minute) => formatSimulationTime(Number(minute), horizon).compact}
                formatter={(value, name) => [
                  Array.isArray(value)
                    ? `${Math.round(Number(value[0]))}–${Math.round(Number(value[1]))}`
                    : Math.round(Number(value)),
                  name,
                ]}
              />
              <Legend />
              {chartSlots.map((chartSlot) => {
                const scenarioPrefix = view === 'split' ? `${chartSlot.toUpperCase()} ` : '';
                const color = chartSlot === 'a' ? '#075e73' : '#9a4f25';
                const fill = chartSlot === 'a' ? '#b8d3da' : '#ebc8ad';
                return (
                  <Fragment key={chartSlot}>
                    <Area
                      dataKey={`${chartSlot}Band`}
                      name={`${scenarioPrefix}10th–90th percentile`}
                      type="stepAfter"
                      stroke="none"
                      fill={fill}
                      fillOpacity={view === 'split' ? 0.38 : 0.7}
                    />
                    <Line
                      dataKey={`${chartSlot}Median`}
                      name={`${scenarioPrefix}median`}
                      type="stepAfter"
                      stroke={color}
                      strokeWidth={2}
                      dot={false}
                    />
                  </Fragment>
                );
              })}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <footer className="visualizer-provenance">
        <div>
          <strong>Representative replay</strong>
          <span>
            Replication {trace ? trace.replication + 1 : '—'} · selected by standardized
            median-distance
          </span>
        </div>
        <div>
          <strong>Reproducibility</strong>
          <span>
            Seed {result.scenario.seed.toLocaleString()} · {result.algorithmVersion}
          </span>
        </div>
        <p>
          Synthetic educational model; not institution-calibrated and not for staffing, clinical,
          regulatory, or operational decisions.
        </p>
      </footer>
    </section>
  );
}
