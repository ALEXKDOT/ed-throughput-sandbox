import { describe, expect, it } from 'vitest';
import { sampleTruncatedLognormal } from '../simulation/distributions';

describe('conditional lognormal sampling', () => {
  it.each([
    [180, 0.6, 5, 1440, 0.5, 179.96420993521434],
    [240, 0.75, 1, 4320, 0.5, 239.98687878555936],
    [90, 0.35, 5, 1440, 0.1, 57.47020403964109],
    [240, 0.85, 5, 1440, 0.9, 663.5470098476158],
  ])('matches the fixed transform vector', (median, sigma, lower, upper, uniform, expected) => {
    expect(sampleTruncatedLognormal(median, sigma, lower, upper, uniform)).toBeCloseTo(
      expected,
      10,
    );
  });

  it('is finite, bounded, and nondecreasing across extreme uniforms', () => {
    const uniforms = [0, Number.EPSILON, 0.001, 0.1, 0.5, 0.9, 0.999, 1 - 2 ** -32, 1];
    const values = uniforms.map((uniform) => sampleTruncatedLognormal(240, 0.85, 5, 1440, uniform));
    expect(values.every((value) => Number.isFinite(value) && value >= 5 && value <= 1440)).toBe(
      true,
    );
    expect(values.every((value, index) => index === 0 || value >= values[index - 1]!)).toBe(true);
  });

  it('returns exact zero without logarithms for the zero-boarding special case', () => {
    expect(sampleTruncatedLognormal(0, 0.75, 1, 4320, 0.5)).toBe(0);
  });
});
