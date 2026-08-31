export function quantile(values: readonly number[], probability: number): number | null {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (finite.length === 0) return null;
  if (finite.length === 1) return finite[0]!;
  const position = (finite.length - 1) * Math.min(1, Math.max(0, probability));
  const lower = Math.floor(position);
  const fraction = position - lower;
  const low = finite[lower]!;
  const high = finite[Math.min(lower + 1, finite.length - 1)]!;
  return low + fraction * (high - low);
}

export const median = (values: readonly number[]) => quantile(values, 0.5);

export const p90 = (values: readonly number[]) => quantile(values, 0.9);

export function finiteOrNull(value: number | null | undefined): number | null {
  return value == null || !Number.isFinite(value) || value < 0 ? null : value;
}
