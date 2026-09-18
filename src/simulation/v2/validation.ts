import { ESI_LEVELS, type ScenarioConfigV2, type VisualizerCapacitiesV2 } from './types';

export type ValidationResultV2 =
  { ok: true; value: ScenarioConfigV2 } | { ok: false; error: string };

export function sharedRunSettingsErrorV2(
  a: ScenarioConfigV2,
  b: ScenarioConfigV2,
): string | undefined {
  if (a.seed !== b.seed || a.replications !== b.replications) {
    return 'Baseline and intervention must share a seed and replication count.';
  }
  if (
    a.window.warmUpMinutes !== b.window.warmUpMinutes ||
    a.window.analysisMinutes !== b.window.analysisMinutes
  ) {
    return 'Baseline and intervention must share warm-up and analysis windows.';
  }
  return undefined;
}

function finiteInRange(value: number, minimum: number, maximum: number): boolean {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}

function normalized(values: readonly number[]): boolean {
  return (
    values.every((value) => finiteInRange(value, 0, 1)) &&
    Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) <= 1e-6
  );
}

const CAPACITY_KEYS: readonly (keyof VisualizerCapacitiesV2)[] = [
  'triageSpots',
  'mainRooms',
  'fastTrackSpaces',
  'hallwayBeds',
  'traumaBays',
  'observationBeds',
  'behavioralHealthBeds',
  'ctScanners',
  'mriScanners',
  'xrayRooms',
  'ultrasoundRooms',
  'labProcessors',
  'dischargeSeats',
  'boardingBeds',
];

const SERVICE_KINDS = new Set([
  'triage',
  'initialTreatment',
  'ct',
  'mri',
  'xray',
  'ultrasound',
  'lab',
  'reassessment',
  'dischargeLounge',
  'boarding',
]);
const MAX_SUPPORTED_ARRIVALS_PER_HOUR = 150;
const MIN_CUMULATIVE_SCALE = 0.05;
const MAX_CUMULATIVE_SCALE = 10;

export function validateScenarioV2(input: unknown): ValidationResultV2 {
  try {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      return { ok: false, error: 'Visualizer scenario must be a JSON object.' };
    }
    const value = input as ScenarioConfigV2;
    if (value.schemaVersion !== 2 || value.modelVersion !== 'edts-model-v2') {
      return { ok: false, error: 'This is not a model-v2 visualizer scenario.' };
    }
    if (
      typeof value.name !== 'string' ||
      !value.name.trim() ||
      value.name.length > 64 ||
      [...value.name].some((character) => {
        const code = character.charCodeAt(0);
        return code < 32 || code === 127;
      })
    ) {
      return { ok: false, error: 'Scenario name must contain 1–64 safe characters.' };
    }
    if (!Number.isSafeInteger(value.seed) || value.seed < 1 || value.seed > 4_294_967_295) {
      return { ok: false, error: 'Seed must be an integer from 1 to 4,294,967,295.' };
    }
    if (
      !Number.isInteger(value.replications) ||
      value.replications < 10 ||
      value.replications > 100
    ) {
      return { ok: false, error: 'Replications must be an integer from 10 to 100.' };
    }
    if (
      !Number.isInteger(value.window.warmUpMinutes) ||
      value.window.warmUpMinutes < 0 ||
      value.window.warmUpMinutes > 7 * 24 * 60 ||
      !Number.isInteger(value.window.analysisMinutes) ||
      value.window.analysisMinutes < 24 * 60 ||
      value.window.analysisMinutes > 14 * 24 * 60
    ) {
      return { ok: false, error: 'Simulation window is outside the supported range.' };
    }
    if (!finiteInRange(value.demand.meanArrivalsPerHour, 0.5, 25)) {
      return { ok: false, error: 'Mean arrivals must be from 0.5 to 25 per hour.' };
    }
    if (
      !Array.isArray(value.demand.hourlyMultipliers) ||
      value.demand.hourlyMultipliers.length !== 24 ||
      value.demand.hourlyMultipliers.some((item) => !finiteInRange(item, 0.05, 5)) ||
      Math.abs(value.demand.hourlyMultipliers.reduce((sum, item) => sum + item, 0) / 24 - 1) > 1e-6
    ) {
      return {
        ok: false,
        error: 'Arrival profile must contain 24 finite positive multipliers averaging 1.0.',
      };
    }
    if (!normalized(ESI_LEVELS.map((esi) => value.demand.esiMix[esi]))) {
      return { ok: false, error: 'ESI probabilities must be finite and sum to 100%.' };
    }
    if (!normalized([value.demand.arrivalModeMix.walkIn, value.demand.arrivalModeMix.ambulance])) {
      return { ok: false, error: 'Arrival-mode probabilities must be finite and sum to 100%.' };
    }

    const zeroAllowed = new Set<keyof VisualizerCapacitiesV2>([
      'fastTrackSpaces',
      'hallwayBeds',
      'observationBeds',
      'behavioralHealthBeds',
      'boardingBeds',
    ]);
    for (const key of CAPACITY_KEYS) {
      const capacity = value.capacities[key];
      const minimum = zeroAllowed.has(key) ? 0 : 1;
      if (!Number.isInteger(capacity) || capacity < minimum || capacity > 80) {
        return { ok: false, error: `${key} capacity is outside the supported range.` };
      }
      if (key === 'observationBeds' && capacity !== 0) {
        return {
          ok: false,
          error: 'Observation routing is deferred; observation capacity must be 0.',
        };
      }
    }
    if (CAPACITY_KEYS.reduce((sum, key) => sum + value.capacities[key], 0) > 300) {
      return { ok: false, error: 'Total configured resources cannot exceed 300.' };
    }

    const nonBoardingDurations = [
      value.durations.triageMedian,
      ...ESI_LEVELS.map((esi) => value.durations.treatmentMedianByEsi[esi]),
      value.durations.reassessmentMedian,
      value.durations.ctMedian,
      value.durations.mriMedian,
      value.durations.xrayMedian,
      value.durations.ultrasoundMedian,
      value.durations.labMedian,
      value.durations.dischargeLoungeMedian,
    ];
    if (
      nonBoardingDurations.some((duration) => !finiteInRange(duration, 1, 1_440)) ||
      !finiteInRange(value.durations.boardingMedian, 1, 4_320)
    ) {
      return { ok: false, error: 'Service durations must be finite positive minutes.' };
    }
    if (!finiteInRange(value.durations.variability, 0.05, 1.5)) {
      return { ok: false, error: 'Duration variability is outside the supported range.' };
    }
    if (!finiteInRange(value.durations.globalScale, 0.25, 4)) {
      return { ok: false, error: 'Care-duration scale must be between 0.25 and 4.' };
    }
    if (ESI_LEVELS.some((esi) => !finiteInRange(value.admissionRates[esi], 0, 1))) {
      return { ok: false, error: 'Admission probabilities must be from 0% to 100%.' };
    }

    if (!Array.isArray(value.interventions) || value.interventions.length > 100) {
      return { ok: false, error: 'Interventions must be an array.' };
    }
    const interventionIds = new Set<string>();
    const plannedCapacities = { ...value.capacities };
    let cumulativeArrivalScale = 1;
    let cumulativeBoardingScale = 1;
    const cumulativeServiceScales = new Map<string, number>();
    const orderedInterventions = value.interventions
      .map((intervention, index) => ({ intervention, index }))
      .sort((a, b) => a.intervention.atMinute - b.intervention.atMinute || a.index - b.index)
      .map(({ intervention }) => intervention);
    for (const intervention of orderedInterventions) {
      if (
        typeof intervention.id !== 'string' ||
        typeof intervention.label !== 'string' ||
        !intervention.id ||
        intervention.id.length > 80 ||
        intervention.label.length > 100 ||
        interventionIds.has(intervention.id) ||
        !Array.isArray(intervention.actions) ||
        intervention.actions.length === 0 ||
        intervention.actions.length > 20
      ) {
        return { ok: false, error: 'Interventions require unique safe IDs, labels, and actions.' };
      }
      interventionIds.add(intervention.id);
      if (
        !Number.isInteger(intervention.atMinute) ||
        intervention.atMinute >= value.window.analysisMinutes ||
        !finiteInRange(
          intervention.atMinute,
          -value.window.warmUpMinutes,
          value.window.analysisMinutes,
        )
      ) {
        return {
          ok: false,
          error: `Intervention ${intervention.label} is outside the simulation window.`,
        };
      }
      for (const action of intervention.actions) {
        if (action.kind === 'addCapacity') {
          if (
            !CAPACITY_KEYS.includes(action.capacity) ||
            action.capacity === 'observationBeds' ||
            !Number.isInteger(action.count) ||
            action.count < 1 ||
            action.count > 40
          ) {
            return { ok: false, error: 'Capacity additions contain an invalid target or count.' };
          }
          plannedCapacities[action.capacity] += action.count;
          if (
            plannedCapacities[action.capacity] > 80 ||
            CAPACITY_KEYS.reduce((sum, key) => sum + plannedCapacities[key], 0) > 300
          ) {
            return {
              ok: false,
              error: 'Scheduled capacity additions exceed the supported resource limits.',
            };
          }
        } else if (
          action.kind === 'scaleArrivals' ||
          action.kind === 'scaleBoarding' ||
          action.kind === 'scaleService'
        ) {
          if (
            !finiteInRange(action.multiplier, 0.1, 5) ||
            (action.kind === 'scaleService' && !SERVICE_KINDS.has(action.service))
          ) {
            return { ok: false, error: 'Intervention scaling action is invalid.' };
          }
          if (action.kind === 'scaleArrivals') {
            cumulativeArrivalScale *= action.multiplier;
            const peakHourlyRate =
              value.demand.meanArrivalsPerHour *
              Math.max(...value.demand.hourlyMultipliers) *
              cumulativeArrivalScale;
            if (
              cumulativeArrivalScale < MIN_CUMULATIVE_SCALE ||
              !Number.isFinite(peakHourlyRate) ||
              peakHourlyRate > MAX_SUPPORTED_ARRIVALS_PER_HOUR
            ) {
              return {
                ok: false,
                error: `Scheduled arrival scaling exceeds ${MAX_SUPPORTED_ARRIVALS_PER_HOUR} supported arrivals per hour.`,
              };
            }
          } else if (action.kind === 'scaleBoarding') {
            cumulativeBoardingScale *= action.multiplier;
          } else {
            cumulativeServiceScales.set(
              action.service,
              (cumulativeServiceScales.get(action.service) ?? 1) * action.multiplier,
            );
          }
          const serviceScale =
            action.kind === 'scaleService'
              ? cumulativeServiceScales.get(action.service)!
              : action.kind === 'scaleBoarding'
                ? cumulativeBoardingScale
                : 1;
          const combinedBoardingScale =
            cumulativeBoardingScale * (cumulativeServiceScales.get('boarding') ?? 1);
          if (
            serviceScale < MIN_CUMULATIVE_SCALE ||
            serviceScale > MAX_CUMULATIVE_SCALE ||
            combinedBoardingScale < MIN_CUMULATIVE_SCALE ||
            combinedBoardingScale > MAX_CUMULATIVE_SCALE
          ) {
            return {
              ok: false,
              error: 'Scheduled service scaling exceeds the supported cumulative range.',
            };
          }
        } else {
          return { ok: false, error: 'Intervention action kind is not supported.' };
        }
      }
    }

    const clean: ScenarioConfigV2 = {
      schemaVersion: 2,
      modelVersion: 'edts-model-v2',
      name: value.name,
      seed: value.seed,
      replications: value.replications,
      window: {
        warmUpMinutes: value.window.warmUpMinutes,
        analysisMinutes: value.window.analysisMinutes,
      },
      demand: {
        meanArrivalsPerHour: value.demand.meanArrivalsPerHour,
        hourlyMultipliers: [...value.demand.hourlyMultipliers],
        esiMix: Object.fromEntries(
          ESI_LEVELS.map((esi) => [esi, value.demand.esiMix[esi]]),
        ) as ScenarioConfigV2['demand']['esiMix'],
        arrivalModeMix: {
          walkIn: value.demand.arrivalModeMix.walkIn,
          ambulance: value.demand.arrivalModeMix.ambulance,
        },
      },
      capacities: {
        triageSpots: value.capacities.triageSpots,
        mainRooms: value.capacities.mainRooms,
        fastTrackSpaces: value.capacities.fastTrackSpaces,
        hallwayBeds: value.capacities.hallwayBeds,
        traumaBays: value.capacities.traumaBays,
        observationBeds: value.capacities.observationBeds,
        behavioralHealthBeds: value.capacities.behavioralHealthBeds,
        ctScanners: value.capacities.ctScanners,
        mriScanners: value.capacities.mriScanners,
        xrayRooms: value.capacities.xrayRooms,
        ultrasoundRooms: value.capacities.ultrasoundRooms,
        labProcessors: value.capacities.labProcessors,
        dischargeSeats: value.capacities.dischargeSeats,
        boardingBeds: value.capacities.boardingBeds,
      },
      durations: {
        triageMedian: value.durations.triageMedian,
        treatmentMedianByEsi: Object.fromEntries(
          ESI_LEVELS.map((esi) => [esi, value.durations.treatmentMedianByEsi[esi]]),
        ) as ScenarioConfigV2['durations']['treatmentMedianByEsi'],
        reassessmentMedian: value.durations.reassessmentMedian,
        ctMedian: value.durations.ctMedian,
        mriMedian: value.durations.mriMedian,
        xrayMedian: value.durations.xrayMedian,
        ultrasoundMedian: value.durations.ultrasoundMedian,
        labMedian: value.durations.labMedian,
        dischargeLoungeMedian: value.durations.dischargeLoungeMedian,
        boardingMedian: value.durations.boardingMedian,
        variability: value.durations.variability,
        globalScale: value.durations.globalScale,
      },
      admissionRates: Object.fromEntries(
        ESI_LEVELS.map((esi) => [esi, value.admissionRates[esi]]),
      ) as ScenarioConfigV2['admissionRates'],
      interventions: value.interventions.map((intervention) => ({
        id: intervention.id,
        label: intervention.label,
        atMinute: intervention.atMinute,
        actions: intervention.actions.map((action) => ({ ...action })),
      })),
    };
    return { ok: true, value: clean };
  } catch {
    return { ok: false, error: 'Visualizer scenario is missing required model-v2 fields.' };
  }
}

export function parseScenarioV2(text: string): ValidationResultV2 {
  if (text.length > 256_000)
    return { ok: false, error: 'Visualizer scenario file exceeds 256 KB.' };
  try {
    return validateScenarioV2(JSON.parse(text) as ScenarioConfigV2);
  } catch {
    return { ok: false, error: 'Visualizer scenario file is not valid JSON.' };
  }
}
