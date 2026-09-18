import { ESI_LEVELS, type EsiLevel, type EsiValuesV2 } from '../simulation/v2/types';

export function rebalanceEsiMix(
  current: EsiValuesV2,
  changedEsi: EsiLevel,
  percent: number,
): EsiValuesV2 {
  const target = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0)) / 100;
  const otherLevels = ESI_LEVELS.filter((esi) => esi !== changedEsi);
  const otherTotal = otherLevels.reduce((sum, esi) => sum + current[esi], 0);
  const remaining = 1 - target;
  const result = { ...current, [changedEsi]: target };

  for (const esi of otherLevels) {
    result[esi] = otherTotal > 0 ? (current[esi] / otherTotal) * remaining : remaining / 4;
  }

  const lastOther = otherLevels.at(-1)!;
  const sum = ESI_LEVELS.reduce((total, esi) => total + result[esi], 0);
  result[lastOther] += 1 - sum;
  return result;
}
