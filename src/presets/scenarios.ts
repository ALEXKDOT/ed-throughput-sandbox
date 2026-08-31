import type { ScenarioConfig } from '../simulation/types';

export const DEFAULT_SCENARIO: ScenarioConfig = {
  schemaVersion: 1,
  name: 'Balanced baseline',
  arrivalRate: 6,
  arrivalProfile: 'daytime',
  customArrivalBlocks: [0.65, 0.85, 1.2, 1.25, 1.15, 0.9],
  acuityMix: { high: 0.12, moderate: 0.56, low: 0.32 },
  totalSpaces: 24,
  treatmentMedians: { high: 240, moderate: 180, low: 90 },
  treatmentTimeScale: 1,
  treatmentVariability: 'moderate',
  admissionRates: { high: 0.45, moderate: 0.18, low: 0.03 },
  boardingMedianMinutes: 240,
  fastTrack: { enabled: false, spaces: 4, medianMinutes: 60 },
  replications: 100,
  seed: 20260831,
};

function scenario(overrides: Partial<ScenarioConfig>): ScenarioConfig {
  return {
    ...DEFAULT_SCENARIO,
    ...overrides,
    acuityMix: { ...DEFAULT_SCENARIO.acuityMix, ...overrides.acuityMix },
    treatmentMedians: { ...DEFAULT_SCENARIO.treatmentMedians, ...overrides.treatmentMedians },
    admissionRates: { ...DEFAULT_SCENARIO.admissionRates, ...overrides.admissionRates },
    fastTrack: { ...DEFAULT_SCENARIO.fastTrack, ...overrides.fastTrack },
    customArrivalBlocks: overrides.customArrivalBlocks ?? [...DEFAULT_SCENARIO.customArrivalBlocks],
  };
}

export const PRESETS = {
  balanced: scenario({ name: 'Balanced baseline' }),
  evening: scenario({
    name: 'Evening surge',
    arrivalRate: 8,
    arrivalProfile: 'evening',
  }),
  boarding: scenario({
    name: 'Boarding bottleneck',
    admissionRates: { high: 0.56, moderate: 0.27, low: 0.06 },
    boardingMedianMinutes: 600,
  }),
  constrained: scenario({ name: 'Capacity constraint', totalSpaces: 16 }),
  fastTrack: scenario({
    name: 'Fast-track experiment',
    fastTrack: { enabled: true, spaces: 4, medianMinutes: 60 },
  }),
  variability: scenario({ name: 'High-variability day', treatmentVariability: 'high' }),
} satisfies Record<string, ScenarioConfig>;

export type PresetKey = keyof typeof PRESETS;

export function cloneScenario(value: ScenarioConfig): ScenarioConfig {
  return {
    ...value,
    customArrivalBlocks: [...value.customArrivalBlocks],
    acuityMix: { ...value.acuityMix },
    treatmentMedians: { ...value.treatmentMedians },
    admissionRates: { ...value.admissionRates },
    fastTrack: { ...value.fastTrack },
  };
}
