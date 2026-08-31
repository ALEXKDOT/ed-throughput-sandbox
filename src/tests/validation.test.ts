import { describe, expect, it } from 'vitest';
import { cloneScenario, DEFAULT_SCENARIO } from '../presets/scenarios';
import type { ScenarioBundle } from '../simulation/types';
import { parseBundle, validateScenario } from '../simulation/validation';
import { decodeBundle, encodeBundle, resultsCsv } from '../utilities/portability';
import { aggregateReplications } from '../simulation/aggregate';
import { runReplication } from '../simulation/engine';

function bundle(): ScenarioBundle {
  return {
    schemaVersion: 1,
    scenarios: {
      a: cloneScenario(DEFAULT_SCENARIO),
      b: { ...cloneScenario(DEFAULT_SCENARIO), name: 'Intervention' },
    },
    activeScenario: 'a',
  };
}

describe('scenario portability and hostile input handling', () => {
  it('preserves valid bundles through JSON and compact URL round trips', () => {
    const original = bundle();
    expect(parseBundle(JSON.stringify(original))).toEqual({ ok: true, value: original });
    expect(decodeBundle(encodeBundle(original))).toEqual({ ok: true, value: original });
  });

  it('safely normalizes a positive acuity mix to one', () => {
    const scenario = cloneScenario(DEFAULT_SCENARIO);
    scenario.acuityMix = { high: 12, moderate: 56, low: 32 };
    const parsed = validateScenario(scenario);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.acuityMix).toEqual({ high: 0.12, moderate: 0.56, low: 0.32 });
      expect(Object.values(parsed.value.acuityMix).reduce((sum, value) => sum + value, 0)).toBe(1);
    }
  });

  it('keeps normalized acuity values identical across repeated validation boundaries', () => {
    const scenario = cloneScenario(DEFAULT_SCENARIO);
    scenario.acuityMix = { high: 1, moderate: 4, low: 1 };
    const first = validateScenario(scenario);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = validateScenario(first.value);
    expect(second).toEqual(first);
    if (!second.ok) return;
    expect(validateScenario(second.value)).toEqual(second);
  });

  it.each([
    [
      'negative admission',
      (scenario: ReturnType<typeof cloneScenario>) => (scenario.admissionRates.high = -0.1),
    ],
    [
      'invalid capacity',
      (scenario: ReturnType<typeof cloneScenario>) => (scenario.totalSpaces = 4),
    ],
    [
      'fractional capacity',
      (scenario: ReturnType<typeof cloneScenario>) => (scenario.totalSpaces = 24.5),
    ],
    [
      'fast allocation',
      (scenario: ReturnType<typeof cloneScenario>) => (scenario.fastTrack.spaces = 24),
    ],
    [
      'nonfinite duration',
      (scenario: ReturnType<typeof cloneScenario>) => (scenario.treatmentMedians.low = Infinity),
    ],
    [
      'tiny boarding median',
      (scenario: ReturnType<typeof cloneScenario>) => (scenario.boardingMedianMinutes = 0.1),
    ],
    [
      'fractional replications',
      (scenario: ReturnType<typeof cloneScenario>) => (scenario.replications = 20.5),
    ],
    ['fractional seed', (scenario: ReturnType<typeof cloneScenario>) => (scenario.seed = 1.5)],
  ])('rejects %s atomically', (_label, mutate) => {
    const original = bundle();
    const invalid = cloneScenario(original.scenarios.a);
    mutate(invalid);
    const raw = { ...original, scenarios: { ...original.scenarios, a: invalid } };
    expect(parseBundle(JSON.stringify(raw)).ok).toBe(false);
    expect(original).toEqual(bundle());
  });

  it('rejects oversized, malformed, wrong-version, and prototype-pollution-shaped input', () => {
    expect(parseBundle('x'.repeat(65_537)).ok).toBe(false);
    expect(parseBundle('{oops').ok).toBe(false);
    expect(parseBundle(JSON.stringify({ ...bundle(), schemaVersion: 2 })).ok).toBe(false);
    const malicious = JSON.parse(JSON.stringify(bundle())) as Record<string, unknown>;
    malicious.scenarios = { ...(malicious.scenarios as object), __proto__: { polluted: true } };
    expect(parseBundle(JSON.stringify(malicious)).ok).toBe(true);
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it('rejects bundles whose paired seed settings disagree', () => {
    const value = bundle();
    value.scenarios.b.seed += 1;
    expect(parseBundle(JSON.stringify(value))).toEqual({
      ok: false,
      error: 'Scenario A and B must share one master seed and replication count.',
    });
  });

  it('guards CSV cells against formula injection', () => {
    const scenario = cloneScenario(DEFAULT_SCENARIO);
    scenario.name = '=CMD()';
    const replication = runReplication(scenario, 0);
    const result = aggregateReplications(scenario, [replication], 1);
    expect(resultsCsv('=CMD()', result)).toContain('"\'=CMD()"');
  });

  it('exports reproducibility fields and combines paired rows under one CSV header', () => {
    const scenario = cloneScenario(DEFAULT_SCENARIO);
    const result = aggregateReplications(scenario, [runReplication(scenario, 0)], 1);
    const combined = `${resultsCsv('Scenario A', result)}\n${resultsCsv('Scenario B', result, false)}`;
    expect(combined.match(/"scenario","algorithm_version"/gu)).toHaveLength(1);
    expect(combined).toContain('"schema_version","master_seed","configured_replications"');
    expect(combined).toContain(`"${scenario.seed}","${scenario.replications}"`);
    expect(combined).toContain('"treatment start occurs in analysis window"');
    expect(combined).toContain('"departure occurs in analysis window"');
    expect(resultsCsv('Scenario A', result).match(/"wait_by_acuity"/gu)).toHaveLength(6);
    expect(combined).toContain('"high_median_wait"');
    expect(combined).toContain('"moderate_p90_wait"');
    expect(combined).toContain('"low_p90_wait"');
    expect(combined).not.toContain('\n\n');
  });
});
