import { resolveHourlyProfile } from '../presets/profiles';
import { deriveSeed, patientUniforms, Random } from './random';
import type { AcuityTier, PatientRecord, ScenarioConfig } from './types';

function samplePoisson(mean: number, random: Random): number {
  if (!(mean > 0)) return 0;
  const threshold = Math.exp(-mean);
  let product = 1;
  let count = 0;
  do {
    count += 1;
    product *= random.next();
  } while (product > threshold);
  return count - 1;
}

export function selectAcuity(uniform: number, mix: ScenarioConfig['acuityMix']): AcuityTier {
  if (uniform < mix.high) return 'high';
  if (uniform < mix.high + mix.moderate) return 'moderate';
  return 'low';
}

export function generatePatientStream(
  scenario: ScenarioConfig,
  replication: number,
  durationMinutes = 48 * 60,
): PatientRecord[] {
  const profile = resolveHourlyProfile(scenario.arrivalProfile, scenario.customArrivalBlocks);
  const hourCount = Math.ceil(durationMinutes / 60);
  const arrivalTimes: number[] = [];

  for (let hour = 0; hour < hourCount; hour += 1) {
    const hourOfDay = hour % 24;
    const random = new Random(deriveSeed(scenario.seed, 0x415252, replication, hour));
    const expected = scenario.arrivalRate * (profile[hourOfDay] ?? 1);
    const count = samplePoisson(expected, random);
    const offsets = Array.from({ length: count }, () => random.next() * 60).sort((a, b) => a - b);
    for (const offset of offsets) {
      const time = hour * 60 + offset;
      if (time < durationMinutes) arrivalTimes.push(time);
    }
  }

  return arrivalTimes.map((arrivalTime, ordinal) => {
    const uniforms = patientUniforms(scenario.seed, replication, ordinal);
    return {
      id: ordinal,
      arrivalTime,
      queueEntryTime: arrivalTime,
      acuity: selectAcuity(uniforms.acuity, scenario.acuityMix),
      serviceUniform: uniforms.service,
      admissionUniform: uniforms.admission,
      boardingUniform: uniforms.boarding,
    };
  });
}
