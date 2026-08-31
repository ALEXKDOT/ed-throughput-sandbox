import { describe, expect, it } from 'vitest';
import { ARRIVAL_PROFILES, normalizeProfile, resolveHourlyProfile } from '../presets/profiles';
import { cloneScenario, DEFAULT_SCENARIO } from '../presets/scenarios';
import { generatePatientStream, selectAcuity } from '../simulation/patientStream';

describe('arrival and acuity streams', () => {
  it('normalizes every hourly profile to mean one', () => {
    for (const profile of Object.values(ARRIVAL_PROFILES)) {
      expect(profile).toHaveLength(24);
      expect(profile.every((value) => Number.isFinite(value) && value >= 0)).toBe(true);
      expect(profile.reduce((sum, value) => sum + value, 0) / 24).toBeCloseTo(1, 12);
    }
    expect(resolveHourlyProfile('custom', [0.5, 1, 1.5, 2, 1, 0.5])).toHaveLength(24);
    expect(normalizeProfile([0, 0, 0])).toEqual([1, 1, 1]);
  });

  it('matches the exact first-hour Poisson count and sorted offsets', () => {
    const scenario = cloneScenario(DEFAULT_SCENARIO);
    scenario.arrivalProfile = 'flat';
    const firstHour = generatePatientStream(scenario, 0, 60).map((patient) => patient.arrivalTime);
    expect(firstHour).toHaveLength(8);
    expect(firstHour).toEqual([
      8.710606112144887, 13.623445630073547, 16.320034693926573, 18.486077995039523,
      19.595053461380303, 27.287182160653174, 44.50973199214786, 49.99086117837578,
    ]);
  });

  it('uses exact categorical boundaries for acuity', () => {
    const mix = { high: 0.12, moderate: 0.56, low: 0.32 };
    expect(selectAcuity(0.119999999, mix)).toBe('high');
    expect(selectAcuity(0.12, mix)).toBe('moderate');
    expect(selectAcuity(0.679999999, mix)).toBe('moderate');
    expect(selectAcuity(0.68, mix)).toBe('low');
  });
});
