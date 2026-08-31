import type { ChangeEvent } from 'react';
import type { ScenarioBundle } from '../../simulation/types';

type Slot = 'a' | 'b';

interface ScenarioBarProps {
  bundle: ScenarioBundle;
  active: Slot;
  comparisonMode: boolean;
  runState: 'idle' | 'running' | 'complete' | 'cancelled' | 'error';
  runningSlots: Slot[];
  progress: number;
  stale: Record<Slot, boolean>;
  hasResult: Record<Slot, boolean>;
  onSelect: (slot: Slot) => void;
  onRename: (name: string) => void;
  onDuplicate: () => void;
  onSwap: () => void;
  onCompare: () => void;
  onRun: () => void;
  onCancel: () => void;
  onShare: () => void;
  onExportJson: () => void;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
  onReset: () => void;
}

export function ScenarioBar({
  bundle,
  active,
  comparisonMode,
  runState,
  runningSlots,
  progress,
  stale,
  hasResult,
  onSelect,
  onRename,
  onDuplicate,
  onSwap,
  onCompare,
  onRun,
  onCancel,
  onShare,
  onExportJson,
  onImport,
  onReset,
}: ScenarioBarProps) {
  const activeScenario = bundle.scenarios[active];
  return (
    <section className="scenario-bar" aria-label="Scenario workspace">
      <div className="scenario-tabs" role="tablist" aria-label="Scenarios">
        {(['a', 'b'] as const).map((slot) => {
          const selected = active === slot;
          const scenario = bundle.scenarios[slot];
          return (
            <button
              key={slot}
              id={`scenario-tab-${slot}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="assumptions-panel"
              tabIndex={selected ? 0 : -1}
              className={`scenario-tab${selected ? ' is-active' : ''}`}
              onClick={() => onSelect(slot)}
              onKeyDown={(event) => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                const next: Slot = event.key === 'ArrowLeft' || event.key === 'Home' ? 'a' : 'b';
                onSelect(next);
                window.setTimeout(
                  () => document.getElementById(`scenario-tab-${next}`)?.focus(),
                  0,
                );
              }}
            >
              <span className="scenario-letter">Scenario {slot.toUpperCase()}</span>
              <span className="scenario-tab-name">{scenario.name}</span>
              <span className={`scenario-state${stale[slot] ? ' is-stale' : ''}`}>
                {runState === 'running' && runningSlots.includes(slot)
                  ? 'Running'
                  : stale[slot]
                    ? 'Changes not run'
                    : hasResult[slot]
                      ? 'Current'
                      : 'Not run'}
              </span>
            </button>
          );
        })}
      </div>
      <div className="scenario-tools">
        <label className="scenario-name-field">
          <span className="sr-only">Active scenario name</span>
          <input
            type="text"
            maxLength={48}
            value={activeScenario.name}
            onChange={(event) => onRename(event.target.value)}
            onBlur={(event) => onRename(event.currentTarget.value.trim())}
          />
        </label>
        <div className="toolbar-actions" aria-label="Scenario actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onDuplicate}
            disabled={runState === 'running'}
          >
            Duplicate A → B
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={onSwap}
            disabled={runState === 'running'}
          >
            Swap
          </button>
          <button
            type="button"
            className={`secondary-button${comparisonMode ? ' is-pressed' : ''}`}
            aria-pressed={comparisonMode}
            onClick={onCompare}
          >
            {comparisonMode ? 'Comparing A + B' : 'Compare scenarios'}
          </button>
          <details
            className="more-menu"
            onKeyDown={(event) => {
              if (event.key !== 'Escape') return;
              event.preventDefault();
              event.currentTarget.open = false;
              event.currentTarget.querySelector('summary')?.focus();
            }}
          >
            <summary aria-label="More scenario actions">More</summary>
            <div className="more-menu-popover">
              <button type="button" onClick={onShare}>
                Copy share link
              </button>
              <button type="button" onClick={onExportJson}>
                Export scenario JSON
              </button>
              <button type="button" onClick={onReset}>
                Reset active scenario
              </button>
              <label className="menu-file-label">
                Import scenario JSON
                <input type="file" accept="application/json,.json" onChange={onImport} />
              </label>
            </div>
          </details>
        </div>
      </div>
      <div className="run-cluster">
        {runState === 'running' && (
          <>
            <div className="progress-copy">
              <span>Running replications</span>
              <strong aria-hidden="true">{Math.round(progress * 100)}%</strong>
            </div>
            <progress
              value={progress}
              max={1}
              aria-label={`Simulation progress: ${Math.round(progress * 100)}%`}
            />
          </>
        )}
        <button
          key="run-action"
          type="button"
          className={runState === 'running' ? 'cancel-button' : 'primary-button run-button'}
          onClick={runState === 'running' ? onCancel : onRun}
        >
          {runState === 'running' ? (
            'Cancel run'
          ) : (
            <>
              <span aria-hidden="true">▶</span>
              {comparisonMode ? 'Run both scenarios' : `Run Scenario ${active.toUpperCase()}`}
            </>
          )}
        </button>
      </div>
    </section>
  );
}
