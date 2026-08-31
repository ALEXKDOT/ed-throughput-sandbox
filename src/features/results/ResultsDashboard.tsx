import { lazy, Suspense } from 'react';
import { FlowMap } from '../../components/FlowMap';
import type { AggregateResult, ComparisonResult, MetricKey } from '../../simulation/types';
import { formatNumber } from '../../utilities/format';
import { ComparisonPanel } from '../comparison/ComparisonPanel';
import { MetricCard } from './MetricCard';

const SystemCharts = lazy(async () => {
  const module = await import('./SystemCharts');
  return { default: module.SystemCharts };
});

interface ResultsDashboardProps {
  active: 'a' | 'b';
  results: Partial<Record<'a' | 'b', AggregateResult>>;
  comparison?: ComparisonResult;
  comparisonMode: boolean;
  stale: boolean;
  runState: 'idle' | 'running' | 'complete' | 'cancelled' | 'error';
  runError?: string;
  onRun: () => void;
  onExportCsv: () => void;
  onPrint: () => void;
}

const CORE_METRICS: MetricKey[] = [
  'medianWait',
  'p90Wait',
  'boarderHours',
  'departures',
  'averageOccupied',
  'highOccupancyTime',
  'peakQueue',
  'remainingInSystem',
];

const ADDITIONAL_METRICS: MetricKey[] = [
  'arrivals',
  'waitingEnd',
  'occupiedEnd',
  'medianLos',
  'dischargedLos',
  'admittedLos',
  'peakOccupied',
];

export function ResultsDashboard({
  active,
  results,
  comparison,
  comparisonMode,
  stale,
  runState,
  runError,
  onRun,
  onExportCsv,
  onPrint,
}: ResultsDashboardProps) {
  const activeResult = results[active];
  if (!activeResult) {
    return (
      <section className="results-empty" aria-labelledby="results-title">
        {runState === 'error' && (
          <div className="notice notice--error" role="alert">
            <strong>Simulation did not complete.</strong>
            <span>{runError ?? 'No partial results were published.'}</span>
            <button type="button" className="secondary-button" onClick={onRun}>
              Try again
            </button>
          </div>
        )}
        {runState === 'cancelled' && (
          <div className="notice" role="status">
            <strong>Run cancelled.</strong>
            <span>No partial results were published.</span>
            <button type="button" className="secondary-button" onClick={onRun}>
              Run again
            </button>
          </div>
        )}
        <FlowMap />
        <div className="empty-state-copy">
          <span className="empty-state-mark" aria-hidden="true">
            24h
          </span>
          <div>
            <span className="section-kicker">Ready to simulate</span>
            <h2 id="results-title">See how the system responds</h2>
            <p>
              Run repeated seeded simulations to estimate waits, occupancy, flow, and boarding—with
              10th–90th percentile uncertainty intervals across replications.
            </p>
            <button
              type="button"
              className="primary-button"
              onClick={onRun}
              disabled={runState === 'running'}
            >
              {runState === 'running' ? 'Simulation running…' : 'Run simulation'}
            </button>
          </div>
        </div>
        <div className="why-card">
          <strong>Why this exists</strong>
          <p>
            Crowding rarely has a single cause. This sandbox makes system interactions visible so
            users can test operational hypotheses before working with institution-specific data.
          </p>
        </div>
      </section>
    );
  }

  const primary = comparisonMode && comparison ? comparison.a : activeResult;
  const secondary = comparisonMode && comparison ? comparison.b : undefined;
  const primaryLabel =
    comparisonMode && comparison ? comparison.a.scenario.name : activeResult.scenario.name;

  return (
    <section className="results-dashboard" aria-labelledby="results-title">
      {stale && (
        <div className="notice notice--stale" role="status">
          <span>
            <strong>Assumptions changed.</strong> Values below are labeled as a previous run until
            you simulate the updated assumptions.
          </span>
          <button
            type="button"
            className="secondary-button"
            onClick={onRun}
            disabled={runState === 'running'}
          >
            Run updated assumptions
          </button>
        </div>
      )}
      {runState === 'error' && (
        <div className="notice notice--error" role="alert">
          <span>
            <strong>Simulation did not complete.</strong>{' '}
            {runError ?? 'The last complete results remain visible.'}
          </span>
          <button type="button" className="secondary-button" onClick={onRun}>
            Try again
          </button>
        </div>
      )}
      {runState === 'cancelled' && (
        <div className="notice" role="status">
          Run cancelled. The last complete results remain visible.
        </div>
      )}
      <div className="results-heading">
        <div>
          <span className="section-kicker">
            {stale ? 'Previous run · ' : ''}
            {primary.replicationCount} seeded replications ·{' '}
            {Math.round(primary.elapsedMilliseconds)}
            ms
          </span>
          <h2 id="results-title">Results for {primaryLabel}</h2>
          <p>
            Each metric is computed within a replication; headline values are medians across
            replications, with 10th–90th percentile intervals. Warm-up observations are excluded.
          </p>
        </div>
        <div className="results-actions print-hidden">
          <button type="button" className="secondary-button" onClick={onExportCsv}>
            Export CSV
          </button>
          <button type="button" className="secondary-button" onClick={onPrint}>
            Print report
          </button>
        </div>
      </div>
      {comparisonMode && comparison && <ComparisonPanel comparison={comparison} />}
      <FlowMap compact />
      {comparisonMode && comparison && <h3 className="detail-heading">Scenario A detail</h3>}
      <div className="metric-grid">
        {CORE_METRICS.map((metric) => (
          <MetricCard key={metric} metric={metric} value={primary.metrics[metric]} />
        ))}
      </div>
      <details className="additional-metrics" open>
        <summary>Additional measures</summary>
        <div className="metric-grid">
          {ADDITIONAL_METRICS.map((metric) => (
            <MetricCard key={metric} metric={metric} value={primary.metrics[metric]} />
          ))}
        </div>
      </details>
      <Suspense
        fallback={
          <div className="chart-skeleton" role="status">
            <div className="chart-card chart-placeholder chart-placeholder--status">
              Preparing 15-minute status charts…
            </div>
            <div className="chart-card chart-placeholder chart-placeholder--flow">
              Preparing hourly flow chart…
            </div>
          </div>
        }
      >
        <SystemCharts
          primary={primary}
          comparison={secondary}
          primaryLabel={primary.scenario.name}
          comparisonLabel={secondary?.scenario.name}
        />
      </Suspense>
      <section className="chart-card wait-card" aria-labelledby="wait-acuity-title">
        <div className="card-heading-row">
          <div>
            <span className="section-kicker">Wait for an eligible treatment space</span>
            <h3 id="wait-acuity-title">Wait by acuity</h3>
          </div>
        </div>
        <div className="wait-list">
          {(['high', 'moderate', 'low'] as const).map((tier) => {
            const value = primary.tierWaits[tier];
            const max = Math.max(
              1,
              ...(['high', 'moderate', 'low'] as const).map(
                (item) => primary.tierWaits[item].p90.high ?? 0,
              ),
            );
            const low = value.median.low ?? 0;
            const high = value.median.high ?? 0;
            const mid = value.median.median ?? 0;
            return (
              <div className="wait-row" key={tier}>
                <strong>{tier[0]!.toUpperCase() + tier.slice(1)}</strong>
                <div className="wait-track" aria-hidden="true">
                  <span
                    className="wait-interval"
                    style={{
                      left: `${(low / max) * 100}%`,
                      width: `${Math.max(1, ((high - low) / max) * 100)}%`,
                    }}
                  />
                  <span className="wait-median" style={{ left: `${(mid / max) * 100}%` }} />
                </div>
                <span>
                  Median {formatNumber(value.median.median, 'minutes')} (10th–90th{' '}
                  {formatNumber(value.median.low, 'minutes')}–
                  {formatNumber(value.median.high, 'minutes')}); p90{' '}
                  {formatNumber(value.p90.median, 'minutes')} (10th–90th{' '}
                  {formatNumber(value.p90.low, 'minutes')}–{formatNumber(value.p90.high, 'minutes')}
                  )
                </span>
              </div>
            );
          })}
        </div>
        <p className="chart-note">
          Marks show the median-across-replications estimate; bars span its 10th–90th percentile
          interval. Text also reports the separately calculated within-replication 90th-percentile
          wait and its across-replication interval.
        </p>
      </section>
      <div className="results-footnote">
        <strong>Scope reminder</strong>
        <p>
          “Wait” means wait for a treatment space—not door to provider. Treatment duration combines
          several operational steps; boarding is an aggregate output constraint.
        </p>
      </div>
    </section>
  );
}
