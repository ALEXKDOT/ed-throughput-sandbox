const UINT32_SCALE = 4_294_967_296;

export const RNG_ALGORITHM_VERSION = 'edts-prng-v1-mulberry32-mix32';

function mix(value: number): number {
  let next = value >>> 0;
  next = Math.imul(next ^ (next >>> 16), 0x21f0aaad);
  next = Math.imul(next ^ (next >>> 15), 0x735a2d97);
  return (next ^ (next >>> 15)) >>> 0;
}

export function deriveSeed(masterSeed: number, ...parts: number[]): number {
  let seed = mix(masterSeed >>> 0);
  for (const part of parts) seed = mix(seed ^ mix(part >>> 0));
  return seed || 0x6d2b79f5;
}

export class Random {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0 || 0x6d2b79f5;
  }

  nextUint32(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return (value ^ (value >>> 14)) >>> 0;
  }

  next(): number {
    return this.nextUint32() / UINT32_SCALE;
  }

  exponential(ratePerMinute: number): number {
    if (!(ratePerMinute > 0)) return Number.POSITIVE_INFINITY;
    return -Math.log(1 - this.next()) / ratePerMinute;
  }
}

export function patientUniforms(masterSeed: number, replication: number, ordinal: number) {
  const stream = new Random(deriveSeed(masterSeed, 0x504154, replication, ordinal));
  return {
    acuity: stream.next(),
    service: stream.next(),
    admission: stream.next(),
    boarding: stream.next(),
  };
}
