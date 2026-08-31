import type { ArrivalProfileName } from '../simulation/types';

const rawProfiles: Record<Exclude<ArrivalProfileName, 'custom'>, readonly number[]> = {
  flat: Array.from({ length: 24 }, () => 1),
  daytime: [
    0.55, 0.48, 0.44, 0.42, 0.46, 0.58, 0.78, 1.02, 1.24, 1.38, 1.45, 1.48, 1.44, 1.38, 1.32, 1.28,
    1.22, 1.15, 1.04, 0.94, 0.84, 0.75, 0.68, 0.6,
  ],
  evening: [
    0.54, 0.46, 0.42, 0.4, 0.43, 0.52, 0.65, 0.78, 0.9, 0.98, 1.05, 1.1, 1.16, 1.22, 1.3, 1.42,
    1.56, 1.68, 1.7, 1.58, 1.38, 1.14, 0.9, 0.68,
  ],
  overnight: [
    1.55, 1.62, 1.56, 1.42, 1.28, 1.12, 0.92, 0.78, 0.68, 0.62, 0.58, 0.56, 0.58, 0.62, 0.68, 0.74,
    0.8, 0.88, 0.98, 1.08, 1.18, 1.3, 1.4, 1.5,
  ],
};

export function normalizeProfile(values: readonly number[]): number[] {
  const safe = values.map((value) => (Number.isFinite(value) && value >= 0 ? value : 0));
  const mean = safe.reduce((sum, value) => sum + value, 0) / safe.length;
  if (mean <= 0) return safe.map(() => 1);
  return safe.map((value) => value / mean);
}

export const ARRIVAL_PROFILES = Object.fromEntries(
  Object.entries(rawProfiles).map(([name, values]) => [name, normalizeProfile(values)]),
) as Record<Exclude<ArrivalProfileName, 'custom'>, number[]>;

export function resolveHourlyProfile(
  name: ArrivalProfileName,
  customBlocks: readonly number[],
): number[] {
  if (name !== 'custom') return ARRIVAL_PROFILES[name];
  const hourly = Array.from({ length: 24 }, (_, hour) => customBlocks[Math.floor(hour / 4)] ?? 1);
  return normalizeProfile(hourly);
}
