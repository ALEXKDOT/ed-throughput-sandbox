import type { VariabilityPreset } from './types';

export const TREATMENT_SIGMA: Record<VariabilityPreset, number> = {
  low: 0.35,
  moderate: 0.6,
  high: 0.85,
};

export const BOARDING_SIGMA = 0.75;
export const DISTRIBUTION_ALGORITHM_VERSION = 'edts-distributions-v1';

// Abramowitz and Stegun 7.1.26; adequate for truncation bounds and simulation sampling.
export function normalCdf(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const polynomial =
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
  const erf = sign * (1 - polynomial * Math.exp(-x * x));
  return 0.5 * (1 + erf);
}

// Peter J. Acklam's rational approximation of the inverse standard-normal CDF.
export function inverseNormalCdf(probability: number): number {
  const p = Math.min(1 - Number.EPSILON, Math.max(Number.EPSILON, probability));
  const a = [
    -39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716,
    2.506628277459239,
  ];
  const b = [
    -54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972,
    -13.28068155288572,
  ];
  const c = [
    -0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734,
    4.374664141464968, 2.938163982698783,
  ];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const low = 0.02425;
  const high = 1 - low;

  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
    );
  }
  if (p <= high) {
    const q = p - 0.5;
    const r = q * q;
    return (
      ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q) /
      (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1)
    );
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(
    (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
    ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
  );
}

export function sampleTruncatedLognormal(
  median: number,
  sigma: number,
  minimum: number,
  maximum: number,
  uniform: number,
): number {
  if (median === 0) return 0;
  if (!(median > 0) || !(sigma > 0) || !(minimum > 0) || !(maximum > minimum)) {
    throw new Error('Invalid truncated lognormal parameters.');
  }
  const mu = Math.log(median);
  const lowerProbability = normalCdf((Math.log(minimum) - mu) / sigma);
  const upperProbability = normalCdf((Math.log(maximum) - mu) / sigma);
  const boundedUniform = Math.min(1 - Number.EPSILON, Math.max(Number.EPSILON, uniform));
  const probability = lowerProbability + boundedUniform * (upperProbability - lowerProbability);
  const sampled = Math.exp(mu + sigma * inverseNormalCdf(probability));
  // Approximate CDF/inverse-CDF pairs can drift a few ulps past a hard boundary.
  const epsilon = (maximum - minimum) * Number.EPSILON;
  return Math.min(maximum - epsilon, Math.max(minimum + epsilon, sampled));
}
