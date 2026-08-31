import { describe, expect, it } from 'vitest';
import { deriveSeed, patientUniforms, Random, RNG_ALGORITHM_VERSION } from '../simulation/random';

describe('versioned random streams', () => {
  it('matches the fixed seed-mixer and raw-word conformance vectors', () => {
    expect(RNG_ALGORITHM_VERSION).toBe('edts-prng-v1-mulberry32-mix32');
    const vectors = [
      { seed: 1, words: [2693262067, 11749833, 2265367787, 4213581821] },
      {
        seed: deriveSeed(20260831, 0x415252, 0, 0),
        derived: 2036032225,
        words: [2312405730, 538637787, 3147352936, 3080807377],
      },
      {
        seed: deriveSeed(20260831, 0x504154, 0, 0),
        derived: 278027772,
        words: [1331915774, 1762190320, 2457447237, 1473026535],
      },
      {
        seed: deriveSeed(20260831, 0x504154, 7, 123),
        derived: 642873659,
        words: [985288489, 1450344597, 2782806137, 1331530683],
      },
    ];
    for (const vector of vectors) {
      if (vector.derived) expect(vector.seed).toBe(vector.derived);
      const random = new Random(vector.seed);
      expect(Array.from({ length: 4 }, () => random.nextUint32())).toEqual(vector.words);
    }
  });

  it('uses the documented patient draw order', () => {
    expect(patientUniforms(20260831, 0, 0)).toEqual({
      acuity: 0.31011080695316195,
      service: 0.4102919064462185,
      admission: 0.5721690219361335,
      boarding: 0.3429657162632793,
    });
  });

  it('changes streams when the seed changes', () => {
    const first = new Random(1);
    const second = new Random(2);
    expect(Array.from({ length: 8 }, () => first.next())).not.toEqual(
      Array.from({ length: 8 }, () => second.next()),
    );
  });
});
