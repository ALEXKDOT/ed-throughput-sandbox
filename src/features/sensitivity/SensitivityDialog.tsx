import { useEffect, useRef, useState } from 'react';
import {
  CartesianGrid,
  ErrorBar,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  SensitivityOutcome,
  SensitivityParameter,
  SensitivityResult,
} from '../../simulation/types';
import { METRIC_DEFINITIONS, formatNumber } from '../../utilities/format';
import { trapFocus } from '../../utilities/focusTrap';

const PARAMETERS: Record<SensitivityParameter, string> = {
  arrivalRate: 'Mean arrivals per hour',
  totalSpaces: 'Treatment spaces',
  treatmentTimeScale: 'Treatment-time scale',
  overallAdmissionRate: 'Overall admission rate',
  boardingMedianMinutes: 'Median boarding duration',
  fastTrackSpaces: 'Fast-track allocation',
};
const OUTCOMES: Record<SensitivityOutcome, string> = {
  medianWait: 'Median wait',
  p90Wait: '90th-percentile wait',
  boarderHours: 'Boarder-hours',
  highOccupancyTime: 'Time at or above 90% occupancy',
  departures: 'Departures',
  remainingInSystem: 'Patients remaining in system',
};

interface SensitivityDialogProps {
  open: boolean;
  status: 'idle' | 'running' | 'complete' | 'cancelled' | 'error';
  progress: number;
  result?: SensitivityResult;
  resultStale: boolean;
  error?: string;
  onClose: () => void;
  onRun: (parameter: SensitivityParameter, outcome: SensitivityOutcome) => void;
  onCancel: () => void;
  onExport: () => void;
}

export function SensitivityDialog({
  open,
  status,
  progress,
  result,
  resultStale,
  error,
  onClose,
  onRun,
  onCancel,
  onExport,
}: SensitivityDialogProps) {
  const [parameter, setParameter] = useState<SensitivityParameter>('totalSpaces');
  const [outcome, setOutcome] = useState<SensitivityOutcome>('medianWait');
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    window.setTimeout(() => closeRef.current?.focus(), 0);
    return () => previous?.focus();
  }, [open]);
  if (!open) return null;
  const unit = METRIC_DEFINITIONS[outcome].unit;
  const displayedResult =
    !resultStale && result?.parameter === parameter && result.outcome === outcome
      ? result
      : undefined;
  const parameterUnit =
    parameter === 'arrivalRate'
      ? 'patients/hour'
      : parameter === 'totalSpaces' || parameter === 'fastTrackSpaces'
        ? 'spaces'
        : parameter === 'treatmentTimeScale' || parameter === 'overallAdmissionRate'
          ? '%'
          : 'minutes';
  const displayParameterValue = (value: number) =>
    parameter === 'treatmentTimeScale' || parameter === 'overallAdmissionRate'
      ? value * 100
      : value;
  const chartData = displayedResult?.points.map((point) => ({
    value: displayParameterValue(point.value),
    median: point.outcome.median,
    error:
      point.outcome.median == null || point.outcome.low == null || point.outcome.high == null
        ? [0, 0]
        : [point.outcome.median - point.outcome.low, point.outcome.high - point.outcome.median],
  }));
  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="sensitivity-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sensitivity-title"
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
          trapFocus(event, dialogRef.current);
        }}
      >
        <div className="dialog-header">
          <div>
            <span className="section-kicker">One parameter at a time</span>
            <h2 id="sensitivity-title">Sensitivity explorer</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close sensitivity explorer"
          >
            ×
          </button>
        </div>
        <p>
          Sweep up to seven valid values around the active scenario while preserving the seed
          structure. At a tight integer boundary, every distinct valid value is used. This explores
          one assumption at a time and does not evaluate interactions among simultaneous changes,
          establish causality, or predict real-world effectiveness.
        </p>
        <div className="sensitivity-controls">
          <label>
            <span>Parameter</span>
            <select
              value={parameter}
              onChange={(event) => setParameter(event.target.value as SensitivityParameter)}
            >
              {Object.entries(PARAMETERS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Outcome</span>
            <select
              value={outcome}
              onChange={(event) => setOutcome(event.target.value as SensitivityOutcome)}
            >
              {Object.entries(OUTCOMES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {status === 'running' ? (
            <button type="button" className="cancel-button" onClick={onCancel}>
              Cancel
            </button>
          ) : (
            <button
              type="button"
              className="primary-button"
              onClick={() => onRun(parameter, outcome)}
            >
              Run sensitivity
            </button>
          )}
        </div>
        {status === 'running' && (
          <div className="sensitivity-progress">
            <span>Running sensitivity analysis… {Math.round(progress * 100)}%</span>
            <progress
              value={progress}
              max={1}
              aria-label={`Sensitivity analysis progress: ${Math.round(progress * 100)}%`}
            />
          </div>
        )}
        {status === 'error' && (
          <div className="notice notice--error" role="alert">
            <strong>Sensitivity run did not complete.</strong> {error ?? 'Try the sweep again.'}
          </div>
        )}
        {status === 'cancelled' && (
          <div className="notice" role="status">
            <strong>Sensitivity run cancelled.</strong> No partial result was published.
          </div>
        )}
        {result && !displayedResult && status !== 'running' && (
          <div className="notice notice--stale" role="status">
            {resultStale
              ? 'The active scenario changed. Run the sweep to calculate matching sensitivity results.'
              : 'The parameter or outcome changed. Run the sweep to calculate matching results.'}
          </div>
        )}
        {displayedResult ? (
          <div className="sensitivity-results">
            <div className="sensitivity-result-heading">
              <p>
                {status !== 'complete' ? 'Previous run · ' : ''}
                {displayedResult.scenarioName} · {displayedResult.points.length} points · baseline{' '}
                {displayParameterValue(displayedResult.baselineValue).toFixed(
                  parameter === 'totalSpaces' || parameter === 'fastTrackSpaces' ? 0 : 1,
                )}{' '}
                {parameterUnit} · {displayedResult.replicationsPerPoint} replications per point ·
                seed {displayedResult.seed}
              </p>
              <button type="button" className="secondary-button" onClick={onExport}>
                Export CSV
              </button>
            </div>
            <div
              className="sensitivity-chart"
              role="img"
              aria-label={`${OUTCOMES[displayedResult.outcome]} versus ${PARAMETERS[displayedResult.parameter]} for ${displayedResult.scenarioName}, with median and 10th to 90th percentile uncertainty`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 16, right: 24, bottom: 12, left: 8 }}>
                  <CartesianGrid stroke="#e6ecef" />
                  <XAxis
                    dataKey="value"
                    name={PARAMETERS[displayedResult.parameter]}
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    tick={{ fontSize: 12 }}
                    label={{ value: parameterUnit, position: 'insideBottomRight', offset: -4 }}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    width={62}
                    label={{ value: unit, angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip formatter={(value) => formatNumber(Number(value), unit)} />
                  <ReferenceLine
                    x={displayParameterValue(displayedResult.baselineValue)}
                    stroke="#526874"
                    strokeDasharray="4 4"
                    label={{ value: 'Baseline', position: 'insideTopRight', fontSize: 12 }}
                  />
                  <Line
                    dataKey="median"
                    stroke="#075e73"
                    strokeWidth={2.5}
                    isAnimationActive={false}
                  >
                    <ErrorBar dataKey="error" width={5} stroke="#526874" direction="y" />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>
                      {PARAMETERS[displayedResult.parameter]} ({parameterUnit})
                    </th>
                    <th>Median</th>
                    <th>10th–90th percentile</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedResult.points.map((point) => (
                    <tr key={point.value}>
                      <th>{displayParameterValue(point.value).toFixed(1)}</th>
                      <td>{formatNumber(point.outcome.median, unit)}</td>
                      <td>
                        {formatNumber(point.outcome.low, unit)}–
                        {formatNumber(point.outcome.high, unit)} (n={point.outcome.n})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : status === 'idle' ? (
          <div className="sensitivity-empty">
            Choose a parameter and outcome, then run the sweep.
          </div>
        ) : null}
      </section>
    </div>
  );
}
