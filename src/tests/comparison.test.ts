import { describe, expect, it } from 'vitest';
import {
  changedAssumptions,
  demandAssumptionsDiffer,
} from '../features/comparison/ComparisonPanel';
import { cloneScenario, DEFAULT_SCENARIO } from '../presets/scenarios';

describe('comparison transparency', () => {
  it('lists every model-affecting changed input and flags custom demand differences', () => {
    const a = cloneScenario(DEFAULT_SCENARIO);
    const b = cloneScenario(DEFAULT_SCENARIO);
    a.arrivalProfile = 'custom';
    b.arrivalProfile = 'custom';
    b.customArrivalBlocks = [0.4, 0.8, 1.2, 1.8, 1.4, 0.6];
    b.acuityMix = { high: 0.2, moderate: 0.5, low: 0.3 };
    b.treatmentMedians.high = 300;
    b.fastTrack.enabled = true;
    b.fastTrack.medianMinutes = 45;

    const labels = changedAssumptions(a, b).map((change) => change.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        'Custom arrival blocks',
        'Acuity mix',
        'Tier treatment medians',
        'Fast-track allocation',
        'Fast-track median duration',
      ]),
    );
    expect(demandAssumptionsDiffer(a, b)).toBe(true);
  });
});
