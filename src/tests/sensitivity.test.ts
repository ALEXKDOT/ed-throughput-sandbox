import { describe, expect, it } from 'vitest';
import { cloneScenario, DEFAULT_SCENARIO } from '../presets/scenarios';
import { weightedAdmissionRate } from '../simulation/admission';
import {
  sensitivityReferenceValue,
  sensitivityValues,
  withSensitivityValue,
} from '../simulation/sensitivity';
import type { SensitivityParameter } from '../simulation/types';
import { validateScenario } from '../simulation/validation';

const PARAMETERS: SensitivityParameter[] = [
  'arrivalRate',
  'totalSpaces',
  'treatmentTimeScale',
  'overallAdmissionRate',
  'boardingMedianMinutes',
  'fastTrackSpaces',
];

describe('one-at-a-time sensitivity bounds', () => {
  it.each(PARAMETERS)('produces seven distinct valid default values for %s', (parameter) => {
    const scenario = cloneScenario(DEFAULT_SCENARIO);
    const values = sensitivityValues(scenario, parameter);
    expect(values).toHaveLength(7);
    expect(new Set(values).size).toBe(7);
    for (const value of values) {
      const candidate = withSensitivityValue(scenario, parameter, value);
      expect(validateScenario(candidate)).toMatchObject({ ok: true });
      if (parameter === 'overallAdmissionRate') {
        expect(weightedAdmissionRate(candidate.admissionRates, candidate.acuityMix)).toBeCloseTo(
          value,
          10,
        );
      }
    }
  });

  it('uses every distinct valid fast-track allocation at the minimum capacity boundary', () => {
    const scenario = cloneScenario(DEFAULT_SCENARIO);
    scenario.totalSpaces = 5;
    scenario.fastTrack.spaces = 4;
    expect(sensitivityValues(scenario, 'fastTrackSpaces')).toEqual([0, 1, 2, 3, 4]);
  });

  it('keeps rounded treatment-scale points valid at a narrow imported boundary', () => {
    const scenario = cloneScenario(DEFAULT_SCENARIO);
    scenario.treatmentMedians = { high: 17, moderate: 17, low: 17 };
    scenario.treatmentTimeScale = 5 / 17;
    const values = sensitivityValues(scenario, 'treatmentTimeScale');
    expect(values.length).toBeGreaterThan(0);
    expect(new Set(values).size).toBe(values.length);
    for (const value of values) {
      expect(
        validateScenario(withSensitivityValue(scenario, 'treatmentTimeScale', value)),
      ).toMatchObject({
        ok: true,
      });
    }
  });

  it('returns the baseline when treatment medians leave no sweep width', () => {
    const scenario = cloneScenario(DEFAULT_SCENARIO);
    scenario.treatmentMedians = { high: 5, moderate: 1440, low: 90 };
    scenario.treatmentTimeScale = 1;
    expect(sensitivityValues(scenario, 'treatmentTimeScale')).toEqual([1]);
  });

  it('reports the exact baseline parameter value used for the reference line', () => {
    const scenario = cloneScenario(DEFAULT_SCENARIO);
    expect(sensitivityReferenceValue(scenario, 'arrivalRate')).toBe(scenario.arrivalRate);
    expect(sensitivityReferenceValue(scenario, 'overallAdmissionRate')).toBeCloseTo(
      weightedAdmissionRate(scenario.admissionRates, scenario.acuityMix),
      12,
    );
    expect(sensitivityReferenceValue(scenario, 'fastTrackSpaces')).toBe(0);
  });
});
