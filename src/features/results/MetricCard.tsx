import { useId } from 'react';
import type { IntervalValue, MetricKey } from '../../simulation/types';
import { formatNumber, METRIC_DEFINITIONS } from '../../utilities/format';

export function MetricCard({ metric, value }: { metric: MetricKey; value: IntervalValue }) {
  const definition = METRIC_DEFINITIONS[metric];
  const tooltipId = useId();
  const unavailable = value.median == null;
  return (
    <article className="metric-card">
      <div className="metric-label-row">
        <h3>{definition.shortLabel}</h3>
        <button type="button" className="info-tip" aria-describedby={tooltipId}>
          <span aria-hidden="true">i</span>
          <span id={tooltipId} role="tooltip">
            {definition.description}
          </span>
          <span className="sr-only">About {definition.shortLabel}</span>
        </button>
      </div>
      <p className="metric-value">{formatNumber(value.median, definition.unit)}</p>
      {unavailable ? (
        <p className="metric-interval">
          <span>No eligible observations in this run.</span>
          <strong>0 valid replications</strong>
        </p>
      ) : (
        <p className="metric-interval">
          <span>10th–90th percentile</span>
          <strong>
            {formatNumber(value.low, definition.unit)}–{formatNumber(value.high, definition.unit)}
          </strong>
        </p>
      )}
    </article>
  );
}
