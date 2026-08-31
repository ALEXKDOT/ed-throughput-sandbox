import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useState } from 'react';
import type { AggregateResult } from '../../simulation/types';
import { formatClockHour } from '../../utilities/format';

interface SystemChartsProps {
  primary: AggregateResult;
  comparison?: AggregateResult;
  primaryLabel: string;
  comparisonLabel?: string;
}

const tooltipStyle = {
  border: '1px solid #cad5dc',
  borderRadius: 6,
  boxShadow: '0 8px 24px rgba(19, 43, 58, 0.12)',
  fontSize: 12,
};

export function SystemCharts({
  primary,
  comparison,
  primaryLabel,
  comparisonLabel,
}: SystemChartsProps) {
  const [flowScenario, setFlowScenario] = useState<'a' | 'b'>('a');
  const statusData = primary.status.map((point, index) => ({
    minute: point.minute,
    occupied: point.occupied.median,
    occupiedLow: point.occupied.low,
    occupiedBand:
      point.occupied.low == null || point.occupied.high == null
        ? null
        : point.occupied.high - point.occupied.low,
    waiting: point.waiting.median,
    waitingLow: point.waiting.low,
    waitingBand:
      point.waiting.low == null || point.waiting.high == null
        ? null
        : point.waiting.high - point.waiting.low,
    comparisonOccupied: comparison?.status[index]?.occupied.median,
    comparisonWaiting: comparison?.status[index]?.waiting.median,
  }));
  const selectedFlow = flowScenario === 'b' && comparison ? comparison : primary;
  const selectedFlowLabel = flowScenario === 'b' && comparison ? comparisonLabel : primaryLabel;
  const flowData = selectedFlow.flow.map((point) => ({
    hour: point.hour,
    arrivals: point.arrivals.median,
    departures: point.departures.median,
  }));
  const summary = `${primaryLabel} reached a median peak occupancy of ${Math.round(primary.metrics.peakOccupied.median ?? 0)} spaces and a median peak queue of ${Math.round(primary.metrics.peakQueue.median ?? 0)} patients.`;

  return (
    <>
      <section className="chart-card" aria-labelledby="system-status-title">
        <div className="card-heading-row">
          <div>
            <span className="section-kicker">15-minute time-weighted bins</span>
            <h3 id="system-status-title">System status over time</h3>
          </div>
          <div className="chart-legend-text" aria-hidden="true">
            <span>
              <i className="legend-line legend-line--a" />
              {primaryLabel}
            </span>
            {comparison && (
              <span>
                <i className="legend-line legend-line--b" />
                {comparisonLabel}
              </span>
            )}
          </div>
        </div>
        <p className="sr-only">
          {summary} Shaded areas show the 10th to 90th percentile interval for {primaryLabel}.
        </p>
        <div className="small-multiple">
          <h4>Occupied treatment spaces</h4>
          <div
            className="chart-frame"
            role="img"
            aria-label={`Occupied treatment spaces over 24 hours. ${summary}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={statusData} margin={{ top: 8, right: 10, bottom: 4, left: -12 }}>
                <CartesianGrid stroke="#e6ecef" vertical={false} />
                <XAxis
                  dataKey="minute"
                  type="number"
                  domain={[0, 1440]}
                  tickFormatter={(value: number) => formatClockHour(value / 60)}
                  ticks={[0, 360, 720, 1080, 1440]}
                  tick={{ fontSize: 12, fill: '#526874' }}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#526874' }} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={(value) =>
                    `Analysis time: ${formatClockHour(Number(value) / 60)}`
                  }
                  formatter={(value, name) => [Number(value).toFixed(1), String(name)]}
                />
                <Area
                  dataKey="occupiedLow"
                  stackId="occupied-band"
                  stroke="none"
                  fill="transparent"
                />
                <Area
                  dataKey="occupiedBand"
                  stackId="occupied-band"
                  name="10th–90th percentile"
                  stroke="#3f7082"
                  strokeWidth={1}
                  fill="#a9c7d2"
                  fillOpacity={0.5}
                  isAnimationActive={false}
                />
                <ReferenceLine
                  y={primary.scenario.totalSpaces}
                  stroke="#075e73"
                  strokeDasharray="5 4"
                  label={{
                    value:
                      comparison && comparison.scenario.totalSpaces !== primary.scenario.totalSpaces
                        ? 'A capacity'
                        : 'Capacity',
                    position: 'insideTopRight',
                    fontSize: 12,
                    fill: '#075e73',
                  }}
                />
                {comparison && comparison.scenario.totalSpaces !== primary.scenario.totalSpaces && (
                  <ReferenceLine
                    y={comparison.scenario.totalSpaces}
                    stroke="#006b64"
                    strokeDasharray="2 3"
                    label={{
                      value: 'B capacity',
                      position: 'insideBottomRight',
                      fontSize: 12,
                      fill: '#006b64',
                    }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="occupied"
                  name={primaryLabel}
                  stroke="#075e73"
                  strokeWidth={2.25}
                  dot={false}
                  isAnimationActive={false}
                />
                {comparison && (
                  <Line
                    type="monotone"
                    dataKey="comparisonOccupied"
                    name={comparisonLabel}
                    stroke="#006b64"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="small-multiple">
          <h4>Patients waiting for a treatment space</h4>
          <div
            className="chart-frame"
            role="img"
            aria-label={`Patients waiting for a treatment space over 24 hours for ${primaryLabel}${comparison ? ` compared with ${comparisonLabel}` : ''}.`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={statusData} margin={{ top: 8, right: 10, bottom: 4, left: -12 }}>
                <CartesianGrid stroke="#e6ecef" vertical={false} />
                <XAxis
                  dataKey="minute"
                  type="number"
                  domain={[0, 1440]}
                  tickFormatter={(value: number) => formatClockHour(value / 60)}
                  ticks={[0, 360, 720, 1080, 1440]}
                  tick={{ fontSize: 12, fill: '#526874' }}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#526874' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  dataKey="waitingLow"
                  stackId="waiting-band"
                  stroke="none"
                  fill="transparent"
                />
                <Area
                  dataKey="waitingBand"
                  stackId="waiting-band"
                  stroke="#3f7082"
                  strokeWidth={1}
                  fill="#a9c7d2"
                  fillOpacity={0.5}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="waiting"
                  name={primaryLabel}
                  stroke="#075e73"
                  strokeWidth={2.25}
                  dot={false}
                  isAnimationActive={false}
                />
                {comparison && (
                  <Line
                    type="monotone"
                    dataKey="comparisonWaiting"
                    name={comparisonLabel}
                    stroke="#006b64"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <details className="chart-data-details">
          <summary>Read chart data</summary>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>{primaryLabel} occupied, median (p10–p90)</th>
                  <th>{primaryLabel} waiting, median (p10–p90)</th>
                  <th>{primaryLabel} boarders, median</th>
                  {comparison && <th>{comparisonLabel} occupied, median</th>}
                  {comparison && <th>{comparisonLabel} waiting, median</th>}
                </tr>
              </thead>
              <tbody>
                {primary.status.map((point, index) => (
                  <tr key={point.minute}>
                    <th>{formatClockHour(point.minute / 60)}</th>
                    <td>
                      {point.occupied.median?.toFixed(1) ?? 'N/A'} (
                      {point.occupied.low?.toFixed(1) ?? 'N/A'}–
                      {point.occupied.high?.toFixed(1) ?? 'N/A'})
                    </td>
                    <td>
                      {point.waiting.median?.toFixed(1) ?? 'N/A'} (
                      {point.waiting.low?.toFixed(1) ?? 'N/A'}–
                      {point.waiting.high?.toFixed(1) ?? 'N/A'})
                    </td>
                    <td>{point.boarders.median?.toFixed(1) ?? 'N/A'}</td>
                    {comparison && (
                      <td>{comparison.status[index]?.occupied.median?.toFixed(1) ?? 'N/A'}</td>
                    )}
                    {comparison && (
                      <td>{comparison.status[index]?.waiting.median?.toFixed(1) ?? 'N/A'}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section className="chart-card" aria-labelledby="flow-chart-title">
        <div className="card-heading-row">
          <div>
            <span className="section-kicker">Median per replication</span>
            <h3 id="flow-chart-title">Arrival and departure pattern</h3>
          </div>
          {comparison && (
            <label className="chart-scenario-select">
              <span>Flow scenario</span>
              <select
                value={flowScenario}
                onChange={(event) => setFlowScenario(event.target.value as 'a' | 'b')}
              >
                <option value="a">A · {primaryLabel}</option>
                <option value="b">B · {comparisonLabel}</option>
              </select>
            </label>
          )}
        </div>
        <p className="sr-only">Hourly synthetic arrivals and departures for {selectedFlowLabel}.</p>
        <div
          className="chart-frame chart-frame--flow"
          role="img"
          aria-label={`Hourly arrivals and departures bar chart for ${selectedFlowLabel}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={flowData} margin={{ top: 8, right: 10, bottom: 4, left: -12 }}>
              <CartesianGrid stroke="#e6ecef" vertical={false} />
              <XAxis
                dataKey="hour"
                tickFormatter={(value: number) => formatClockHour(value)}
                ticks={[0, 4, 8, 12, 16, 20, 23]}
                tick={{ fontSize: 12, fill: '#526874' }}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#526874' }} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(value) => formatClockHour(Number(value))}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="arrivals"
                name={`${selectedFlowLabel} arrivals`}
                fill="#175e8c"
                radius={[2, 2, 0, 0]}
              />
              <Bar
                dataKey="departures"
                name={`${selectedFlowLabel} departures`}
                fill="#d2ebe8"
                stroke="#006b64"
                strokeWidth={2}
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <details className="chart-data-details">
          <summary>Read hourly flow data</summary>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Hour</th>
                  <th>Arrivals, median (p10–p90)</th>
                  <th>Departures, median (p10–p90)</th>
                </tr>
              </thead>
              <tbody>
                {selectedFlow.flow.map((point) => (
                  <tr key={point.hour}>
                    <th>{formatClockHour(point.hour)}</th>
                    <td>
                      {point.arrivals.median?.toFixed(1) ?? 'N/A'} (
                      {point.arrivals.low?.toFixed(1) ?? 'N/A'}–
                      {point.arrivals.high?.toFixed(1) ?? 'N/A'})
                    </td>
                    <td>
                      {point.departures.median?.toFixed(1) ?? 'N/A'} (
                      {point.departures.low?.toFixed(1) ?? 'N/A'}–
                      {point.departures.high?.toFixed(1) ?? 'N/A'})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
    </>
  );
}
