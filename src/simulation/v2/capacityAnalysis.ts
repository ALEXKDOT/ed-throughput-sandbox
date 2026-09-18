import type { PathwayKind, ScenarioConfigV2 } from './types';

export type DiagnosticCapacityKeyV2 = 'lab' | 'ct' | 'xray' | 'ultrasound' | 'mri';
export type CapacityPressureV2 = 'balanced' | 'tight' | 'overloaded';

export interface DiagnosticCapacityEstimateV2 {
  key: DiagnosticCapacityKeyV2;
  label: string;
  requestsPerHour: number;
  utilization: number;
  pressure: CapacityPressureV2;
}

function pressureFor(utilization: number): CapacityPressureV2 {
  if (utilization >= 1) return 'overloaded';
  if (utilization >= 0.85) return 'tight';
  return 'balanced';
}

function pathwayShares(scenario: ScenarioConfigV2): Record<PathwayKind, number> {
  const lowerEsiShare =
    scenario.demand.esiMix[1] + scenario.demand.esiMix[2] + scenario.demand.esiMix[3];
  const higherEsiShare = scenario.demand.esiMix[4] + scenario.demand.esiMix[5];
  return {
    behavioralHealth: 0.08,
    minorInjury: lowerEsiShare * 0.2 + higherEsiShare * 0.44,
    abdominal: lowerEsiShare * 0.34 + higherEsiShare * 0.1,
    medical: 0.38,
  };
}

/**
 * Approximate steady-state diagnostic load. The estimate uses the configured arrival mix,
 * request probabilities and untruncated lognormal mean, so it is a warning—not a simulation result.
 */
export function diagnosticCapacityEstimatesV2(
  scenario: ScenarioConfigV2,
): DiagnosticCapacityEstimateV2[] {
  const shares = pathwayShares(scenario);
  const probabilities = scenario.diagnosticProbabilities;
  const arrivals = scenario.demand.meanArrivalsPerHour;
  const lognormalMeanFactor = Math.exp(scenario.durations.variability ** 2 / 2);
  const durationScale = scenario.durations.globalScale * lognormalMeanFactor;
  const highAcuityMedicalShare = (scenario.demand.esiMix[1] + scenario.demand.esiMix[2]) * 0.38;
  const otherMedicalShare =
    (scenario.demand.esiMix[3] + scenario.demand.esiMix[4] + scenario.demand.esiMix[5]) * 0.38;

  const requestProbability: Record<DiagnosticCapacityKeyV2, number> = {
    lab: (Object.keys(shares) as PathwayKind[]).reduce(
      (sum, pathway) => sum + shares[pathway] * probabilities.labByPathway[pathway],
      0,
    ),
    ct:
      highAcuityMedicalShare * probabilities.ctMedicalHighAcuity +
      otherMedicalShare * probabilities.ctMedicalOther +
      shares.abdominal * probabilities.ctAbdominal,
    xray: shares.minorInjury * probabilities.xrayMinorInjury,
    ultrasound: shares.abdominal * probabilities.ultrasoundAbdominal,
    mri:
      shares.medical * probabilities.mriMedical +
      shares.behavioralHealth * probabilities.mriBehavioralHealth,
  };
  const resources: Record<
    DiagnosticCapacityKeyV2,
    { label: string; median: number; capacity: number }
  > = {
    lab: {
      label: 'Lab',
      median: scenario.durations.labMedian,
      capacity: scenario.capacities.labProcessors,
    },
    ct: {
      label: 'CT',
      median: scenario.durations.ctMedian,
      capacity: scenario.capacities.ctScanners,
    },
    xray: {
      label: 'X-ray',
      median: scenario.durations.xrayMedian,
      capacity: scenario.capacities.xrayRooms,
    },
    ultrasound: {
      label: 'Ultrasound',
      median: scenario.durations.ultrasoundMedian,
      capacity: scenario.capacities.ultrasoundRooms,
    },
    mri: {
      label: 'MRI',
      median: scenario.durations.mriMedian,
      capacity: scenario.capacities.mriScanners,
    },
  };

  return (Object.keys(resources) as DiagnosticCapacityKeyV2[]).map((key) => {
    const requestsPerHour = arrivals * requestProbability[key];
    const utilization =
      (requestsPerHour * resources[key].median * durationScale) / (60 * resources[key].capacity);
    return {
      key,
      label: resources[key].label,
      requestsPerHour,
      utilization,
      pressure: pressureFor(utilization),
    };
  });
}
