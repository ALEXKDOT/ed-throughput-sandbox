import { describe, expect, it } from 'vitest';
import {
  aggregatePairedDeltas,
  aggregatePairedPercentDeltas,
  aggregateReplications,
} from '../simulation/aggregate';
import { cloneScenario, DEFAULT_SCENARIO } from '../presets/scenarios';
import { runReplication } from '../simulation/engine';

describe('replication aggregation and paired comparisons', () => {
  it('aggregates within replication and returns uncertainty valid counts', () => {
    const scenario = cloneScenario(DEFAULT_SCENARIO);
    const replications = [0, 1, 2].map((index) => runReplication(scenario, index));
    const result = aggregateReplications(scenario, replications, 12);
    expect(result.replicationCount).toBe(3);
    expect(result.metrics.arrivals.n).toBe(3);
    expect(result.metrics.arrivals.low).toBeLessThanOrEqual(result.metrics.arrivals.median!);
    expect(result.metrics.arrivals.high).toBeGreaterThanOrEqual(result.metrics.arrivals.median!);
    expect(result.algorithmVersion).toContain('edts-prng-v1');
  });

  it('identical A/B replications produce exact zero deltas', () => {
    const scenario = cloneScenario(DEFAULT_SCENARIO);
    const replications = [0, 1, 2].map((index) => runReplication(scenario, index));
    const deltas = aggregatePairedDeltas(replications, replications);
    for (const value of Object.values(deltas)) {
      if (value.n > 0) expect(value).toMatchObject({ median: 0, low: 0, high: 0 });
    }
  });

  it('computes percentage changes inside each pair and rejects mismatched IDs', () => {
    const scenario = cloneScenario(DEFAULT_SCENARIO);
    const first = [runReplication(scenario, 0), runReplication(scenario, 1)];
    const second = first.map((result) => ({
      ...result,
      metrics: { ...result.metrics, arrivals: Number(result.metrics.arrivals) * 1.1 },
    }));
    expect(aggregatePairedPercentDeltas(first, second).arrivals.median).toBeCloseTo(10, 10);
    expect(() => aggregatePairedDeltas(first, [...second].reverse())).toThrow(/identifiers/u);
  });

  it('aggregates the reverse percentage direction from pairs before taking quantiles', () => {
    const scenario = cloneScenario(DEFAULT_SCENARIO);
    const source = [runReplication(scenario, 0), runReplication(scenario, 1)];
    const a = source.map((result) => ({
      ...result,
      metrics: { ...result.metrics, arrivals: 1 },
    }));
    const b = source.map((result, index) => ({
      ...result,
      metrics: { ...result.metrics, arrivals: index === 0 ? 1 : 2 },
    }));
    expect(aggregatePairedPercentDeltas(a, b).arrivals.median).toBe(50);
    expect(aggregatePairedPercentDeltas(b, a).arrivals.median).toBe(-25);
  });
});
