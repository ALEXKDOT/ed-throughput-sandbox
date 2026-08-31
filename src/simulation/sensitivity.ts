import { ADMISSION_CAPS, scaleAdmissionRates, weightedAdmissionRate } from './admission';
import type { ScenarioConfig, SensitivityParameter } from './types';
import { validateScenario } from './validation';

function range(center: number, minimum: number, maximum: number, requestedWidth: number): number[] {
  const width = Math.min(maximum - minimum, requestedWidth);
  if (!(width > 1e-12)) return [Math.max(minimum, Math.min(maximum, center))];
  const lower = Math.max(minimum, Math.min(maximum - width, center - width / 2));
  return Array.from({ length: 7 }, (_, index) => lower + (width * index) / 6);
}

function integerRange(center: number, minimum: number, maximum: number, requestedWidth: number) {
  if (maximum - minimum < 6) {
    return Array.from({ length: maximum - minimum + 1 }, (_, index) => minimum + index);
  }
  const width = Math.max(6, Math.min(maximum - minimum, requestedWidth));
  const lower = Math.round(Math.max(minimum, Math.min(maximum - width, center - width / 2)));
  return Array.from({ length: 7 }, (_, index) => lower + Math.round((width * index) / 6));
}

export function sensitivityValues(
  scenario: ScenarioConfig,
  parameter: SensitivityParameter,
): number[] {
  let values: number[];
  switch (parameter) {
    case 'arrivalRate':
      values = range(scenario.arrivalRate, 1, 25, Math.max(6, scenario.arrivalRate * 0.8));
      break;
    case 'totalSpaces':
      values = integerRange(scenario.totalSpaces, 5, 80, 18);
      break;
    case 'treatmentTimeScale': {
      const minimum = Math.max(
        0.25,
        ...Object.values(scenario.treatmentMedians).map((median) => 5 / median),
      );
      const maximum = Math.min(
        2,
        ...Object.values(scenario.treatmentMedians).map((median) => 1440 / median),
      );
      values = range(
        scenario.treatmentTimeScale,
        minimum,
        maximum,
        Math.max(0.3, scenario.treatmentTimeScale * 0.8),
      );
      break;
    }
    case 'overallAdmissionRate': {
      const overall = weightedAdmissionRate(scenario.admissionRates, scenario.acuityMix);
      const maximum = weightedAdmissionRate(ADMISSION_CAPS, scenario.acuityMix);
      values = range(overall, 0, maximum, Math.max(0.06, maximum * 0.6));
      break;
    }
    case 'boardingMedianMinutes':
      values =
        scenario.boardingMedianMinutes === 0
          ? [0, 60, 120, 240, 480, 720, 960]
          : range(
              scenario.boardingMedianMinutes,
              1,
              1440,
              Math.max(180, scenario.boardingMedianMinutes * 0.8),
            );
      break;
    case 'fastTrackSpaces': {
      const maximum = Math.min(12, scenario.totalSpaces - 1);
      values = integerRange(
        scenario.fastTrack.enabled ? scenario.fastTrack.spaces : 0,
        0,
        maximum,
        Math.min(12, maximum),
      );
      break;
    }
  }
  const resolved: number[] = [];
  for (const rawValue of values) {
    const roundedValue = Math.round(rawValue * 1000) / 1000;
    const candidates = roundedValue === rawValue ? [rawValue] : [roundedValue, rawValue];
    const validValue = candidates.find(
      (candidate) => validateScenario(withSensitivityValue(scenario, parameter, candidate)).ok,
    );
    if (
      validValue !== undefined &&
      !resolved.some((existing) => Math.abs(existing - validValue) <= 1e-12)
    ) {
      resolved.push(validValue);
    }
  }
  if (resolved.length === 0) {
    const baseline = sensitivityReferenceValue(scenario, parameter);
    if (validateScenario(withSensitivityValue(scenario, parameter, baseline)).ok) return [baseline];
    throw new Error('These assumptions leave no valid sensitivity range.');
  }
  return resolved;
}

export function sensitivityReferenceValue(
  scenario: ScenarioConfig,
  parameter: SensitivityParameter,
): number {
  if (parameter === 'arrivalRate') return scenario.arrivalRate;
  if (parameter === 'totalSpaces') return scenario.totalSpaces;
  if (parameter === 'treatmentTimeScale') return scenario.treatmentTimeScale;
  if (parameter === 'overallAdmissionRate') {
    return weightedAdmissionRate(scenario.admissionRates, scenario.acuityMix);
  }
  if (parameter === 'boardingMedianMinutes') return scenario.boardingMedianMinutes;
  return scenario.fastTrack.enabled ? scenario.fastTrack.spaces : 0;
}

export function withSensitivityValue(
  scenario: ScenarioConfig,
  parameter: SensitivityParameter,
  value: number,
): ScenarioConfig {
  const next: ScenarioConfig = {
    ...scenario,
    acuityMix: { ...scenario.acuityMix },
    treatmentMedians: { ...scenario.treatmentMedians },
    admissionRates: { ...scenario.admissionRates },
    fastTrack: { ...scenario.fastTrack },
  };
  if (parameter === 'arrivalRate') next.arrivalRate = value;
  if (parameter === 'totalSpaces') {
    next.totalSpaces = Math.round(value);
    next.fastTrack.spaces = Math.min(next.fastTrack.spaces, next.totalSpaces - 1);
  }
  if (parameter === 'treatmentTimeScale') next.treatmentTimeScale = value;
  if (parameter === 'overallAdmissionRate') next.admissionRates = scaleAdmissionRates(value, next);
  if (parameter === 'boardingMedianMinutes') next.boardingMedianMinutes = value;
  if (parameter === 'fastTrackSpaces') {
    next.fastTrack.enabled = value > 0;
    next.fastTrack.spaces = Math.max(1, Math.round(value));
  }
  return next;
}
