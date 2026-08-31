import type { ComparisonResult, MetricKey, ScenarioConfig } from '../../simulation/types';
import { formatDelta, formatNumber, METRIC_DEFINITIONS } from '../../utilities/format';

function percentages(values: ScenarioConfig['acuityMix']): string {
  return `${Math.round(values.high * 100)}/${Math.round(values.moderate * 100)}/${Math.round(values.low * 100)}% H/M/L`;
}

function medians(values: ScenarioConfig['treatmentMedians']): string {
  return `${values.high}/${values.moderate}/${values.low} min H/M/L`;
}

export function changedAssumptions(
  a: ScenarioConfig,
  b: ScenarioConfig,
): { label: string; a: string; b: string }[] {
  const rows: { label: string; a: string; b: string }[] = [];
  const add = (
    different: boolean,
    label: string,
    first: string | number,
    second: string | number,
  ) => {
    if (different) rows.push({ label, a: String(first), b: String(second) });
  };
  add(
    a.arrivalRate !== b.arrivalRate,
    'Mean arrivals',
    `${a.arrivalRate}/hr`,
    `${b.arrivalRate}/hr`,
  );
  add(a.arrivalProfile !== b.arrivalProfile, 'Arrival pattern', a.arrivalProfile, b.arrivalProfile);
  add(
    (a.arrivalProfile === 'custom' || b.arrivalProfile === 'custom') &&
      JSON.stringify(a.customArrivalBlocks) !== JSON.stringify(b.customArrivalBlocks),
    'Custom arrival blocks',
    a.customArrivalBlocks.join('/'),
    b.customArrivalBlocks.join('/'),
  );
  add(
    JSON.stringify(a.acuityMix) !== JSON.stringify(b.acuityMix),
    'Acuity mix',
    percentages(a.acuityMix),
    percentages(b.acuityMix),
  );
  add(a.totalSpaces !== b.totalSpaces, 'Treatment spaces', a.totalSpaces, b.totalSpaces);
  add(
    JSON.stringify(a.treatmentMedians) !== JSON.stringify(b.treatmentMedians),
    'Tier treatment medians',
    medians(a.treatmentMedians),
    medians(b.treatmentMedians),
  );
  add(
    a.treatmentTimeScale !== b.treatmentTimeScale,
    'Treatment-time scale',
    `${Math.round(a.treatmentTimeScale * 100)}%`,
    `${Math.round(b.treatmentTimeScale * 100)}%`,
  );
  add(
    (a.fastTrack.enabled || b.fastTrack.enabled) &&
      a.fastTrack.medianMinutes !== b.fastTrack.medianMinutes,
    'Fast-track median duration',
    `${a.fastTrack.medianMinutes} min`,
    `${b.fastTrack.medianMinutes} min`,
  );
  add(
    JSON.stringify(a.admissionRates) !== JSON.stringify(b.admissionRates),
    'Admission assumptions',
    percentages(a.admissionRates),
    percentages(b.admissionRates),
  );
  add(
    a.boardingMedianMinutes !== b.boardingMedianMinutes,
    'Median boarding duration',
    `${a.boardingMedianMinutes} min`,
    `${b.boardingMedianMinutes} min`,
  );
  add(
    a.fastTrack.enabled !== b.fastTrack.enabled || a.fastTrack.spaces !== b.fastTrack.spaces,
    'Fast-track allocation',
    a.fastTrack.enabled ? `${a.fastTrack.spaces} spaces` : 'Off',
    b.fastTrack.enabled ? `${b.fastTrack.spaces} spaces` : 'Off',
  );
  add(
    a.treatmentVariability !== b.treatmentVariability,
    'Duration variability',
    a.treatmentVariability,
    b.treatmentVariability,
  );
  return rows;
}

export function demandAssumptionsDiffer(a: ScenarioConfig, b: ScenarioConfig): boolean {
  return (
    a.arrivalRate !== b.arrivalRate ||
    a.arrivalProfile !== b.arrivalProfile ||
    ((a.arrivalProfile === 'custom' || b.arrivalProfile === 'custom') &&
      JSON.stringify(a.customArrivalBlocks) !== JSON.stringify(b.customArrivalBlocks)) ||
    JSON.stringify(a.acuityMix) !== JSON.stringify(b.acuityMix)
  );
}

const COMPARISON_METRICS: MetricKey[] = [
  'medianWait',
  'p90Wait',
  'boarderHours',
  'highOccupancyTime',
  'departures',
  'remainingInSystem',
];

function direction(value: number | null): string {
  if (value == null) return 'Not available';
  if (Math.abs(value) < 0.05) return 'Similar';
  return value > 0 ? 'Higher in B' : 'Lower in B';
}

export function ComparisonPanel({ comparison }: { comparison: ComparisonResult }) {
  const changed = changedAssumptions(comparison.a.scenario, comparison.b.scenario);
  const demandChanged = demandAssumptionsDiffer(comparison.a.scenario, comparison.b.scenario);
  const waitDelta = comparison.deltas.medianWait.median;
  const boarderDelta = comparison.deltas.boarderHours.median;
  const waitPhrase = direction(waitDelta).toLowerCase();
  const boarderPhrase = direction(boarderDelta).toLowerCase();
  const largestChange = changed[0]?.label.toLowerCase() ?? 'configured assumptions';

  return (
    <section className="comparison-panel" aria-labelledby="comparison-title">
      <div className="card-heading-row">
        <div>
          <span className="section-kicker">Paired replication deltas · B minus A</span>
          <h3 id="comparison-title">Scenario comparison</h3>
        </div>
      </div>
      {demandChanged && (
        <div className="notice notice--amber" role="note">
          Demand assumptions differ. The comparison reflects both demand and operational changes.
        </div>
      )}
      <div className="changed-assumptions">
        <h4>Changed assumptions</h4>
        {changed.length === 0 ? (
          <p>No assumptions differ. Identical scenarios should produce exact zero paired deltas.</p>
        ) : (
          <div className="change-chips">
            {changed.map((change) => (
              <div className="change-chip" key={change.label}>
                <strong>{change.label}</strong>
                <span>
                  {change.a} → {change.b}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="comparison-table-wrap">
        <table className="comparison-table">
          <thead>
            <tr>
              <th scope="col">Outcome</th>
              <th scope="col">Scenario A · {comparison.a.scenario.name}</th>
              <th scope="col">Scenario B · {comparison.b.scenario.name}</th>
              <th scope="col">Paired change</th>
              <th scope="col">Direction</th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON_METRICS.map((metric) => {
              const definition = METRIC_DEFINITIONS[metric];
              const a = comparison.a.metrics[metric].median;
              const b = comparison.b.metrics[metric].median;
              const delta = comparison.deltas[metric].median;
              const percent = comparison.percentDeltas[metric].median;
              const percentInterval = comparison.percentDeltas[metric];
              return (
                <tr key={metric}>
                  <th scope="row">{definition.shortLabel}</th>
                  <td data-label="Scenario A">
                    {formatNumber(a, definition.unit)}
                    <small>
                      10th–90th {formatNumber(comparison.a.metrics[metric].low, definition.unit)}–
                      {formatNumber(comparison.a.metrics[metric].high, definition.unit)} (n=
                      {comparison.a.metrics[metric].n})
                    </small>
                  </td>
                  <td data-label="Scenario B">
                    {formatNumber(b, definition.unit)}
                    <small>
                      10th–90th {formatNumber(comparison.b.metrics[metric].low, definition.unit)}–
                      {formatNumber(comparison.b.metrics[metric].high, definition.unit)} (n=
                      {comparison.b.metrics[metric].n})
                    </small>
                  </td>
                  <td data-label="Paired change">
                    {formatDelta(delta, definition.unit)}
                    <small>
                      10th–90th {formatDelta(comparison.deltas[metric].low, definition.unit)}–
                      {formatDelta(comparison.deltas[metric].high, definition.unit)} (n=
                      {comparison.deltas[metric].n})
                    </small>
                    {percent != null && Number.isFinite(percent) && (
                      <small>
                        {percent > 0 ? '+' : ''}
                        {percent.toFixed(1)}% · 10th–90th {percentInterval.low?.toFixed(1) ?? 'N/A'}
                        –{percentInterval.high?.toFixed(1) ?? 'N/A'}% (n={percentInterval.n})
                      </small>
                    )}
                  </td>
                  <td data-label="Direction">
                    <span className="direction-label">{direction(delta)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="interpretation" aria-labelledby="interpretation-title">
        <span className="interpretation-icon" aria-hidden="true">
          ≋
        </span>
        <div>
          <h4 id="interpretation-title">Model-bounded interpretation</h4>
          <p>
            Within this synthetic model, Scenario B’s median wait was {waitPhrase}, while
            boarder-hours were {boarderPhrase}. The first configured difference was {largestChange}.
            These conditional results generate hypotheses; they do not establish real-world effects.
          </p>
        </div>
      </div>
    </section>
  );
}
