import { sampleTruncatedLognormal } from '../distributions';
import { deriveSeed, Random } from '../random';
import type { EsiLevel, ScenarioConfigV2, ServiceKind } from './types';

export const V2_RNG_VERSION = 'edts-prng-v2-keyed-streams';

const TAGS: Record<string, number> = {
  esi: 0x455349,
  arrivalMode: 0x4d4f4445,
  pathway: 0x50415448,
  diagnostics: 0x44494147,
  disposition: 0x44495350,
  patience: 0x50415449,
  service: 0x53525643,
};

export function keyedUniform(
  masterSeed: number,
  replication: number,
  patientOrdinal: number,
  tag: keyof typeof TAGS,
  occurrence = 0,
): number {
  return new Random(
    deriveSeed(masterSeed, 0x5632, replication, patientOrdinal, TAGS[tag]!, occurrence),
  ).next();
}

const SERVICE_TAGS: Record<ServiceKind, number> = {
  triage: 1,
  initialTreatment: 2,
  ct: 3,
  mri: 4,
  xray: 5,
  ultrasound: 6,
  lab: 7,
  reassessment: 8,
  dischargeLounge: 9,
  boarding: 10,
};

function serviceMedian(scenario: ScenarioConfigV2, esi: EsiLevel, service: ServiceKind): number {
  switch (service) {
    case 'triage':
      return scenario.durations.triageMedian;
    case 'initialTreatment':
      return scenario.durations.treatmentMedianByEsi[esi];
    case 'ct':
      return scenario.durations.ctMedian;
    case 'mri':
      return scenario.durations.mriMedian;
    case 'xray':
      return scenario.durations.xrayMedian;
    case 'ultrasound':
      return scenario.durations.ultrasoundMedian;
    case 'lab':
      return scenario.durations.labMedian;
    case 'reassessment':
      return scenario.durations.reassessmentMedian;
    case 'dischargeLounge':
      return scenario.durations.dischargeLoungeMedian;
    case 'boarding':
      return scenario.durations.boardingMedian;
  }
}

export function sampleServiceMinutes(
  scenario: ScenarioConfigV2,
  replication: number,
  patientOrdinal: number,
  esi: EsiLevel,
  service: ServiceKind,
  occurrence = 0,
  multiplier = 1,
): number {
  const careScale = service === 'boarding' ? 1 : scenario.durations.globalScale;
  const median = serviceMedian(scenario, esi, service) * careScale * multiplier;
  if (median <= 0) return 0;
  const uniform = keyedUniform(
    scenario.seed,
    replication,
    patientOrdinal,
    'service',
    SERVICE_TAGS[service] * 100 + occurrence,
  );
  return sampleTruncatedLognormal(
    median,
    scenario.durations.variability,
    1,
    service === 'boarding' ? 4_320 : 1_440,
    uniform,
  );
}
