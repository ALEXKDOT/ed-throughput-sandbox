import { useId } from 'react';

interface SliderFieldProps {
  label: string;
  hint?: string;
  value: number;
  minimum: number;
  maximum: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
}

function decimalPlaces(value: number): number {
  const text = String(value);
  return text.includes('.') ? (text.split('.')[1]?.length ?? 0) : 0;
}

export function snapToStep(value: number, minimum: number, maximum: number, step: number): number {
  const clamped = Math.min(maximum, Math.max(minimum, value));
  const snapped = minimum + Math.round((clamped - minimum) / step) * step;
  const scale = 10 ** Math.max(decimalPlaces(minimum), decimalPlaces(maximum), decimalPlaces(step));
  return Math.min(maximum, Math.max(minimum, Math.round(snapped * scale) / scale));
}

export function SliderField({
  label,
  hint,
  value,
  minimum,
  maximum,
  step,
  unit,
  onChange,
}: SliderFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const unitId = `${id}-unit`;
  const descriptionIds = [unit ? unitId : '', hint ? hintId : ''].filter(Boolean).join(' ');
  const update = (next: string) => {
    const parsed = Number(next);
    if (Number.isFinite(parsed)) onChange(snapToStep(parsed, minimum, maximum, step));
  };
  return (
    <div className="field-group">
      <div className="field-label-row">
        <label htmlFor={`${id}-range`}>{label}</label>
        <div className="number-wrap">
          <input
            id={`${id}-number`}
            className="number-input"
            type="number"
            min={minimum}
            max={maximum}
            step={step}
            value={Number(value.toFixed(4))}
            aria-label={`${label}, numeric value`}
            aria-describedby={descriptionIds || undefined}
            onChange={(event) => update(event.target.value)}
          />
          {unit && <span id={unitId}>{unit}</span>}
        </div>
      </div>
      <input
        id={`${id}-range`}
        type="range"
        min={minimum}
        max={maximum}
        step={step}
        value={value}
        aria-label={`${label}${unit ? ` in ${unit}` : ''}`}
        aria-valuetext={`${Number(value.toFixed(4))}${unit ? ` ${unit}` : ''}`}
        aria-describedby={hint ? hintId : undefined}
        onChange={(event) => update(event.target.value)}
      />
      {hint && (
        <p className="field-hint" id={hintId}>
          {hint}
        </p>
      )}
    </div>
  );
}
