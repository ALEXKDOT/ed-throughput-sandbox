import { ADMISSION_CAPS } from './admission';
import type {
  ArrivalProfileName,
  ScenarioBundle,
  ScenarioConfig,
  TierValues,
  VariabilityPreset,
} from './types';

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

const ARRIVAL_PROFILES = new Set<ArrivalProfileName>([
  'flat',
  'daytime',
  'evening',
  'overnight',
  'custom',
]);
const VARIABILITY = new Set<VariabilityPreset>(['low', 'moderate', 'high']);

function record(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function finite(value: unknown, minimum: number, maximum: number): value is number {
  return (
    typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
  );
}

function integer(value: unknown, minimum: number, maximum: number): value is number {
  return finite(value, minimum, maximum) && Number.isInteger(value);
}

function safeName(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length >= 1 &&
    value.length <= 48 &&
    Array.from(value).every((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
  );
}

function tierValues(
  value: unknown,
  maximum: TierValues,
  label: string,
): ValidationResult<TierValues> {
  if (!record(value)) return { ok: false, error: `${label} must contain all three acuity tiers.` };
  for (const tier of ['high', 'moderate', 'low'] as const) {
    if (!finite(value[tier], 0, maximum[tier])) {
      return { ok: false, error: `${label}: ${tier} is outside the supported range.` };
    }
  }
  return {
    ok: true,
    value: {
      high: value.high as number,
      moderate: value.moderate as number,
      low: value.low as number,
    },
  };
}

function normalizedMix(value: unknown): ValidationResult<TierValues> {
  if (!record(value)) {
    return { ok: false, error: 'Acuity mix must contain all three acuity tiers.' };
  }
  for (const tier of ['high', 'moderate', 'low'] as const) {
    if (!finite(value[tier], 0, 100)) {
      return { ok: false, error: `Acuity mix: ${tier} is outside the supported range.` };
    }
  }
  const parsed = {
    high: value.high as number,
    moderate: value.moderate as number,
    low: value.low as number,
  };
  const sum = parsed.high + parsed.moderate + parsed.low;
  if (!(sum > 0)) return { ok: false, error: 'Acuity percentages must have a positive sum.' };
  // Preserve already-normalized values. Re-dividing a mix whose floating-point sum is
  // infinitesimally different from one makes validation non-idempotent across the UI/worker
  // boundary and can incorrectly mark a just-completed run as stale.
  if (Math.abs(sum - 1) <= 1e-12) {
    return { ok: true, value: parsed };
  }
  return {
    ok: true,
    value: {
      high: parsed.high / sum,
      moderate: parsed.moderate / sum,
      low: parsed.low / sum,
    },
  };
}

export function validateScenario(value: unknown): ValidationResult<ScenarioConfig> {
  if (!record(value)) return { ok: false, error: 'Scenario must be a JSON object.' };
  if (value.schemaVersion !== 1)
    return { ok: false, error: 'Unsupported scenario schema version.' };
  if (!safeName(value.name)) return { ok: false, error: 'Scenario name is missing or too long.' };
  if (!finite(value.arrivalRate, 1, 25)) {
    return { ok: false, error: 'Mean arrivals must be between 1 and 25 per hour.' };
  }
  if (!ARRIVAL_PROFILES.has(value.arrivalProfile as ArrivalProfileName)) {
    return { ok: false, error: 'Arrival profile is not recognized.' };
  }
  if (
    !Array.isArray(value.customArrivalBlocks) ||
    value.customArrivalBlocks.length !== 6 ||
    !value.customArrivalBlocks.every((item) => finite(item, 0.1, 3))
  ) {
    return { ok: false, error: 'Custom arrival profile must contain six values from 0.1 to 3.' };
  }
  const acuityMix = normalizedMix(value.acuityMix);
  if (!acuityMix.ok) return acuityMix;
  if (!integer(value.totalSpaces, 5, 80)) {
    return { ok: false, error: 'Treatment spaces must be a whole number from 5 to 80.' };
  }
  const treatmentMedians = tierValues(
    value.treatmentMedians,
    { high: 1440, moderate: 1440, low: 1440 },
    'Treatment medians',
  );
  if (!treatmentMedians.ok) return treatmentMedians;
  if (Object.values(treatmentMedians.value).some((item) => item < 5)) {
    return { ok: false, error: 'Treatment medians must be at least 5 minutes.' };
  }
  if (!finite(value.treatmentTimeScale, 0.25, 2)) {
    return { ok: false, error: 'Treatment-time scale must be between 0.25 and 2.' };
  }
  if (
    Object.values(treatmentMedians.value).some(
      (item) =>
        item * (value.treatmentTimeScale as number) < 5 ||
        item * (value.treatmentTimeScale as number) > 1440,
    )
  ) {
    return {
      ok: false,
      error: 'Scaled treatment medians must remain between 5 and 1,440 minutes.',
    };
  }
  if (!VARIABILITY.has(value.treatmentVariability as VariabilityPreset)) {
    return { ok: false, error: 'Treatment variability preset is not recognized.' };
  }
  const admissionRates = tierValues(value.admissionRates, ADMISSION_CAPS, 'Admission rates');
  if (!admissionRates.ok) return admissionRates;
  if (!finite(value.boardingMedianMinutes, 0, 1440)) {
    return { ok: false, error: 'Median boarding duration must be between 0 and 1,440 minutes.' };
  }
  if (value.boardingMedianMinutes > 0 && value.boardingMedianMinutes < 1) {
    return { ok: false, error: 'A positive boarding median must be at least 1 minute.' };
  }
  if (!record(value.fastTrack) || typeof value.fastTrack.enabled !== 'boolean') {
    return { ok: false, error: 'Fast-track settings are invalid.' };
  }
  if (!integer(value.fastTrack.spaces, 1, (value.totalSpaces as number) - 1)) {
    return { ok: false, error: 'Fast-track allocation must leave at least one main space.' };
  }
  if (!finite(value.fastTrack.medianMinutes, 5, 720)) {
    return { ok: false, error: 'Fast-track median duration must be between 5 and 720 minutes.' };
  }
  if (!integer(value.replications, 20, 200)) {
    return { ok: false, error: 'Replications must be a whole number from 20 to 200.' };
  }
  if (!integer(value.seed, 1, 4_294_967_295)) {
    return { ok: false, error: 'Seed must be a whole number from 1 to 4,294,967,295.' };
  }

  return {
    ok: true,
    value: {
      schemaVersion: 1,
      name: value.name.trim(),
      arrivalRate: value.arrivalRate,
      arrivalProfile: value.arrivalProfile as ArrivalProfileName,
      customArrivalBlocks: [...value.customArrivalBlocks] as ScenarioConfig['customArrivalBlocks'],
      acuityMix: acuityMix.value,
      totalSpaces: value.totalSpaces,
      treatmentMedians: treatmentMedians.value,
      treatmentTimeScale: value.treatmentTimeScale,
      treatmentVariability: value.treatmentVariability as VariabilityPreset,
      admissionRates: admissionRates.value,
      boardingMedianMinutes: value.boardingMedianMinutes,
      fastTrack: {
        enabled: value.fastTrack.enabled,
        spaces: value.fastTrack.spaces,
        medianMinutes: value.fastTrack.medianMinutes,
      },
      replications: value.replications,
      seed: value.seed,
    },
  };
}

export function validateBundle(value: unknown): ValidationResult<ScenarioBundle> {
  if (!record(value) || value.schemaVersion !== 1 || !record(value.scenarios)) {
    return { ok: false, error: 'File is not a version 1 scenario bundle.' };
  }
  const a = validateScenario(value.scenarios.a);
  if (!a.ok) return { ok: false, error: `Scenario A: ${a.error}` };
  const b = validateScenario(value.scenarios.b);
  if (!b.ok) return { ok: false, error: `Scenario B: ${b.error}` };
  if (a.value.seed !== b.value.seed || a.value.replications !== b.value.replications) {
    return {
      ok: false,
      error: 'Scenario A and B must share one master seed and replication count.',
    };
  }
  if (value.activeScenario !== 'a' && value.activeScenario !== 'b') {
    return { ok: false, error: 'Active scenario must be A or B.' };
  }
  return {
    ok: true,
    value: {
      schemaVersion: 1,
      scenarios: { a: a.value, b: b.value },
      activeScenario: value.activeScenario,
      ...(typeof value.exportedAt === 'string' ? { exportedAt: value.exportedAt } : {}),
    },
  };
}

export function parseBundle(text: string): ValidationResult<ScenarioBundle> {
  if (text.length > 65_536) return { ok: false, error: 'Scenario file exceeds the 64 KB limit.' };
  try {
    return validateBundle(JSON.parse(text) as unknown);
  } catch {
    return { ok: false, error: 'Scenario file is not valid JSON.' };
  }
}
