import type { ScenarioConfig, TierValues } from './types';

export const ADMISSION_CAPS: TierValues = { high: 0.9, moderate: 0.6, low: 0.2 };
export const ADMISSION_ANCHOR: TierValues = { high: 0.45, moderate: 0.18, low: 0.03 };

export function weightedAdmissionRate(rates: TierValues, mix: TierValues): number {
  return rates.high * mix.high + rates.moderate * mix.moderate + rates.low * mix.low;
}

export function scaleAdmissionRates(target: number, scenario: ScenarioConfig): TierValues {
  const boundedTarget = Math.max(
    0,
    Math.min(target, weightedAdmissionRate(ADMISSION_CAPS, scenario.acuityMix)),
  );
  if (boundedTarget === 0) return { high: 0, moderate: 0, low: 0 };

  let low = 0;
  let high = 100;
  const scaled = (factor: number): TierValues => ({
    high: Math.min(ADMISSION_CAPS.high, ADMISSION_ANCHOR.high * factor),
    moderate: Math.min(ADMISSION_CAPS.moderate, ADMISSION_ANCHOR.moderate * factor),
    low: Math.min(ADMISSION_CAPS.low, ADMISSION_ANCHOR.low * factor),
  });

  for (let iteration = 0; iteration < 64; iteration += 1) {
    const midpoint = (low + high) / 2;
    if (weightedAdmissionRate(scaled(midpoint), scenario.acuityMix) < boundedTarget) low = midpoint;
    else high = midpoint;
  }
  return scaled((low + high) / 2);
}
