import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { cloneVisualizerScenario, DEFAULT_VISUALIZER_SCENARIO } from '../simulation/v2/defaults';
import { visualizerResultsCsv } from '../simulation/v2/export';
import { adjacentFrameMinuteV2, snapshotAtV2 } from '../simulation/v2/replay';
import type { ScenarioConfigV2, VisualizerRunPayloadV2 } from '../simulation/v2/types';
import { sharedRunSettingsErrorV2, validateScenarioV2 } from '../simulation/v2/validation';
import type {
  VisualizerRunRequestV2,
  VisualizerWorkerResponseV2,
} from '../simulation/v2/workerProtocol';
import { downloadText } from '../utilities/portability';
import { DepartmentMap, type VisualizerSelection } from './DepartmentMap';
import { EvidencePanel } from './EvidencePanel';
import { formatSimulationTime } from './format';
import { InspectorPanel } from './InspectorPanel';
import { LiveKpiStrip } from './LiveKpiStrip';
import { ScenarioLevers } from './ScenarioLevers';

interface VisualizerAppProps {
  active?: boolean;
  onOpenSandbox: () => void;
}

type RunState = 'idle' | 'running' | 'complete' | 'cancelled' | 'error';
type ViewMode = 'a' | 'b' | 'split';
type SeriesMetric = 'census' | 'waiting' | 'boarders' | 'imagingQueue';

interface VisualizerBundle {
  schemaVersion: 2;
  scenarios: Record<'a' | 'b', ScenarioConfigV2>;
}

interface Bookmark {
  id: string;
  minute: number;
  label: string;
}

const STORAGE_KEY = 'ed-throughput-sandbox.visualizer.v2';

function defaultBundle(): VisualizerBundle {
  const baseline = cloneVisualizerScenario(DEFAULT_VISUALIZER_SCENARIO);
  return {
    schemaVersion: 2,
    scenarios: {
      a: baseline,
      b: { ...cloneVisualizerScenario(baseline), name: 'Intervention' },
    },
  };
}

function initialBundle(): VisualizerBundle {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return defaultBundle();
    const parsed = JSON.parse(saved) as VisualizerBundle;
    const validatedA = validateScenarioV2(parsed.scenarios.a);
    const validatedB = validateScenarioV2(parsed.scenarios.b);
    if (
      parsed.schemaVersion === 2 &&
      validatedA.ok &&
      validatedB.ok &&
      !sharedRunSettingsErrorV2(validatedA.value, validatedB.value)
    ) {
      return {
        schemaVersion: 2,
        scenarios: { a: validatedA.value, b: validatedB.value },
      };
    }
  } catch {
    // A malformed or unavailable local store never blocks the visualizer.
  }
  return defaultBundle();
}

function stableKey(scenario: ScenarioConfigV2): string {
  return JSON.stringify(scenario);
}

function phaseLabel(phase: string): string {
  if (phase === 'validating') return 'Checking assumptions';
  if (phase === 'ensemble') return 'Running repeated simulations';
  if (phase === 'selecting') return 'Selecting representative week';
  if (phase === 'tracing') return 'Building exact replay';
  return 'Preparing evidence';
}

export function VisualizerApp({ active = true, onOpenSandbox }: VisualizerAppProps) {
  const [bundle, setBundle] = useState(initialBundle);
  const [view, setView] = useState<ViewMode>('a');
  const [editSlot, setEditSlot] = useState<'a' | 'b'>('a');
  const [inspectorSlot, setInspectorSlot] = useState<'a' | 'b'>('a');
  const [setupOpen, setSetupOpen] = useState(true);
  const [runState, setRunState] = useState<RunState>('idle');
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('Ready to simulate');
  const [error, setError] = useState<string>();
  const [payload, setPayload] = useState<VisualizerRunPayloadV2>();
  const [completedKeys, setCompletedKeys] = useState<Partial<Record<'a' | 'b', string>>>({});
  const [minute, setMinute] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(30);
  const [selection, setSelection] = useState<VisualizerSelection>();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [seriesMetric, setSeriesMetric] = useState<SeriesMetric>('census');
  const [motionPreference, setMotionPreference] = useState<'auto' | 'reduced'>('auto');
  const [toast, setToast] = useState<string>();
  const [announcement, setAnnouncement] = useState('');
  const workerRef = useRef<Worker | null>(null);
  const runIdRef = useRef('');
  const scenarios = bundle.scenarios;

  const systemPrefersReducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reducedMotion = motionPreference === 'reduced' || systemPrefersReducedMotion;

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bundle));
    } catch {
      // Session-only use remains available without browser storage.
    }
  }, [bundle]);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
    },
    [],
  );

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(undefined), 6_000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!active) setPlaying(false);
  }, [active]);

  const traces = payload?.representative.traces ?? {};
  const primarySlot: 'a' | 'b' = view === 'b' ? 'b' : inspectorSlot;
  const primaryTrace = traces[primarySlot];
  const endMinute = Math.max(traces.a?.window.endMinute ?? 0, traces.b?.window.endMinute ?? 0);
  const states = useMemo(
    () => ({
      a: traces.a ? snapshotAtV2(traces.a, minute) : undefined,
      b: traces.b ? snapshotAtV2(traces.b, minute) : undefined,
    }),
    [minute, traces.a, traces.b],
  );
  const stale = {
    a: Boolean(payload?.results.a && completedKeys.a !== stableKey(scenarios.a)),
    b: Boolean(payload?.results.b && completedKeys.b !== stableKey(scenarios.b)),
  };
  const visibleStale = view === 'split' ? stale.a || stale.b : stale[view];

  useEffect(() => {
    if (!playing || !primaryTrace || endMinute <= 0) return;
    let previous = performance.now();
    let animationFrame = 0;
    const advance = (now: number) => {
      const elapsedSeconds = Math.min(0.25, (now - previous) / 1_000);
      previous = now;
      setMinute((current) => {
        const next = Math.min(endMinute, current + elapsedSeconds * speed);
        if (next >= endMinute) {
          setPlaying(false);
          setAnnouncement('Replay reached the end of the representative week.');
        }
        return next;
      });
      animationFrame = window.requestAnimationFrame(advance);
    };
    animationFrame = window.requestAnimationFrame(advance);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [endMinute, playing, primaryTrace, speed]);

  const updateScenario = (scenario: ScenarioConfigV2) => {
    setBundle((current) => {
      const otherSlot = editSlot === 'a' ? 'b' : 'a';
      const sharedChanged =
        scenario.seed !== current.scenarios[editSlot].seed ||
        scenario.replications !== current.scenarios[editSlot].replications;
      return {
        ...current,
        scenarios: {
          ...current.scenarios,
          [editSlot]: scenario,
          ...(sharedChanged
            ? {
                [otherSlot]: {
                  ...current.scenarios[otherSlot],
                  seed: scenario.seed,
                  replications: scenario.replications,
                },
              }
            : {}),
        },
      };
    });
  };

  const selectView = (nextView: ViewMode) => {
    setView(nextView);
    setPlaying(false);
    if (nextView !== 'split') {
      setEditSlot(nextView);
      setInspectorSlot(nextView);
      setSelection((current) => (current?.slot === nextView ? current : undefined));
    }
  };

  const run = () => {
    const slots: ('a' | 'b')[] = view === 'split' ? ['a', 'b'] : [view];
    for (const slot of ['a', 'b'] as const) {
      const validation = validateScenarioV2(scenarios[slot]);
      if (!validation.ok) {
        setError(`${slot === 'a' ? 'Baseline' : 'Intervention'}: ${validation.error}`);
        setRunState('error');
        return;
      }
    }
    const sharedSettingsError = sharedRunSettingsErrorV2(scenarios.a, scenarios.b);
    if (sharedSettingsError) {
      setError(sharedSettingsError);
      setRunState('error');
      return;
    }
    workerRef.current?.terminate();
    const worker = new Worker(new URL('../workers/visualizer.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;
    const runId = crypto.randomUUID();
    runIdRef.current = runId;
    setRunState('running');
    setPlaying(false);
    setError(undefined);
    setProgress(0);
    setPhase('Checking assumptions');
    const request: VisualizerRunRequestV2 = { type: 'v2/run', runId, scenarios, slots };
    worker.addEventListener('message', (event: MessageEvent<VisualizerWorkerResponseV2>) => {
      if (event.data.runId !== runIdRef.current) return;
      if (event.data.type === 'v2/progress') {
        setProgress(event.data.progress);
        setPhase(phaseLabel(event.data.phase));
      } else if (event.data.type === 'v2/result') {
        setPayload(event.data.payload);
        setCompletedKeys(
          Object.fromEntries(slots.map((slot) => [slot, stableKey(scenarios[slot])])) as Partial<
            Record<'a' | 'b', string>
          >,
        );
        setRunState('complete');
        setProgress(1);
        setPhase('Representative week ready');
        setMinute(0);
        setSelection(undefined);
        setBookmarks([]);
        setAnnouncement(
          `${slots.length === 2 ? 'Paired scenarios are' : `Scenario ${slots[0]!.toUpperCase()} is`} ready. Representative replication ${event.data.payload.representative.replication + 1} selected.`,
        );
        worker.terminate();
        if (workerRef.current === worker) workerRef.current = null;
      } else {
        setRunState('error');
        setError(event.data.message);
        setPhase('Run failed');
        worker.terminate();
      }
    });
    worker.addEventListener('error', () => {
      if (runIdRef.current !== runId) return;
      setRunState('error');
      setError(
        'The visualizer worker stopped unexpectedly. Existing completed results were preserved.',
      );
      setPhase('Run failed');
    });
    worker.postMessage(request);
  };

  const cancel = () => {
    runIdRef.current = '';
    workerRef.current?.terminate();
    workerRef.current = null;
    setRunState('cancelled');
    setProgress(0);
    setPhase('Run cancelled');
    setAnnouncement('Visualizer run cancelled. Previous completed results remain available.');
  };

  const step = (direction: -1 | 1) => {
    if (!primaryTrace) return;
    setPlaying(false);
    const next = adjacentFrameMinuteV2(primaryTrace, minute, direction);
    setMinute(next);
    setAnnouncement(`Moved to ${formatSimulationTime(next, endMinute).compact}.`);
  };

  const jump = (target: number) => {
    const safeTarget = Math.max(0, Math.min(endMinute, target));
    setPlaying(false);
    setMinute(safeTarget);
    setAnnouncement(`Jumped to ${formatSimulationTime(safeTarget, endMinute).compact}.`);
  };

  const addBookmark = () => {
    if (!primaryTrace) return;
    const time = formatSimulationTime(minute, endMinute);
    const bookmark: Bookmark = {
      id: crypto.randomUUID(),
      minute,
      label: `${time.dayShort} ${time.clock}`,
    };
    setBookmarks((current) => [...current, bookmark].sort((a, b) => a.minute - b.minute));
    setAnnouncement(`Bookmark added at ${time.compact}.`);
  };

  const cloneBaseline = () => {
    setBundle((current) => ({
      ...current,
      scenarios: {
        ...current.scenarios,
        b: { ...cloneVisualizerScenario(current.scenarios.a), name: 'Intervention' },
      },
    }));
    setEditSlot('b');
    setInspectorSlot('b');
    setView('b');
    setToast('Baseline copied into Intervention. Change assumptions, then run both scenarios.');
  };

  const newSeed = () => {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    const seed = values[0] || 1;
    setBundle((current) => ({
      ...current,
      scenarios: {
        a: { ...current.scenarios.a, seed },
        b: { ...current.scenarios.b, seed },
      },
    }));
    setToast('A new shared seed was generated. Rerun to refresh both scenarios.');
  };

  const exportScenarios = () => {
    const validatedA = validateScenarioV2(scenarios.a);
    const validatedB = validateScenarioV2(scenarios.b);
    if (!validatedA.ok || !validatedB.ok) {
      setError(
        `Export blocked: ${!validatedA.ok ? validatedA.error : !validatedB.ok ? validatedB.error : 'setup is invalid.'}`,
      );
      return;
    }
    const sharedSettingsError = sharedRunSettingsErrorV2(validatedA.value, validatedB.value);
    if (sharedSettingsError) {
      setError(`Export blocked: ${sharedSettingsError}`);
      return;
    }
    downloadText(
      'ed-visualizer-scenarios-v2.json',
      JSON.stringify(
        {
          ...bundle,
          exportedAt: new Date().toISOString(),
          note: 'Synthetic assumptions only. No patient data or simulation trace is included.',
        },
        null,
        2,
      ),
      'application/json',
    );
    setToast('Versioned visualizer assumptions exported. The file contains no patient data.');
  };

  const importScenarios = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 256_000) {
      setError('Import rejected: visualizer setup files must be 256 KB or smaller.');
      return;
    }
    try {
      const candidate = JSON.parse(await file.text()) as VisualizerBundle;
      const validatedA = validateScenarioV2(candidate.scenarios.a);
      const validatedB = validateScenarioV2(candidate.scenarios.b);
      if (candidate.schemaVersion !== 2 || !validatedA.ok || !validatedB.ok) {
        setError(
          `Import rejected: ${!validatedA.ok ? validatedA.error : !validatedB.ok ? validatedB.error : 'the file is not a visualizer-v2 setup.'}`,
        );
        return;
      }
      const sharedSettingsError = sharedRunSettingsErrorV2(validatedA.value, validatedB.value);
      if (sharedSettingsError) {
        setError(`Import rejected: ${sharedSettingsError}`);
        return;
      }
      if (
        !window.confirm(
          'Import this visualizer setup? It will replace both scenario assumptions and clear the current replay.',
        )
      ) {
        setToast('Import cancelled. Existing assumptions and replay were preserved.');
        return;
      }
      runIdRef.current = '';
      workerRef.current?.terminate();
      workerRef.current = null;
      setBundle({
        schemaVersion: 2,
        scenarios: {
          a: cloneVisualizerScenario(validatedA.value),
          b: cloneVisualizerScenario(validatedB.value),
        },
      });
      setPayload(undefined);
      setCompletedKeys({});
      setRunState('idle');
      setPhase('Imported setup ready');
      setMinute(0);
      setPlaying(false);
      setSelection(undefined);
      setBookmarks([]);
      setError(undefined);
      setToast('Visualizer-v2 assumptions imported and validated. Run to calculate results.');
    } catch {
      setError('Import rejected: the selected file is not a valid visualizer-v2 setup.');
    }
  };

  const exportResults = () => {
    if (!payload) return;
    if (visibleStale) {
      setError('Results export is paused because the visible setup has changed. Rerun it first.');
      return;
    }
    downloadText(
      'ed-visualizer-comparison-v2.csv',
      visualizerResultsCsv(payload),
      'text/csv;charset=utf-8',
    );
    setToast('Ensemble metrics, hourly ranges, paired deltas, and provenance exported.');
  };

  const currentTime = formatSimulationTime(minute, endMinute);
  const totalDays = Math.max(1, Math.ceil(endMinute / 1_440));
  const hasTrace = Boolean(primaryTrace);
  const results = payload?.results ?? {};

  return (
    <div
      className={`app-shell visualizer-shell${reducedMotion ? ' visualizer-reduced-motion' : ''}`}
    >
      <a className="skip-link" href="#visualizer-main">
        Skip to visualizer
      </a>
      <a className="skip-link skip-link--results" href="#visualizer-evidence">
        Skip to results
      </a>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      <header className="site-header visualizer-header">
        <button className="brand brand-button" type="button" onClick={onOpenSandbox}>
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>ED Throughput Sandbox</span>
        </button>
        <div className="workspace-tabs" role="group" aria-label="Workspace">
          <button type="button" onClick={onOpenSandbox}>
            Sandbox
          </button>
          <button type="button" className="is-active" aria-current="page">
            Visualizer
          </button>
        </div>
        <div className="visualizer-header-actions">
          <span className="status-badge">Synthetic · no patient data</span>
          <label className="motion-control">
            Motion
            <select
              value={motionPreference}
              onChange={(event) => setMotionPreference(event.target.value as 'auto' | 'reduced')}
            >
              <option value="auto">System setting</option>
              <option value="reduced">Reduced</option>
            </select>
          </label>
          <button className="text-button" type="button" onClick={exportScenarios}>
            Export setup
          </button>
          <label
            className="text-button visualizer-import-button"
            aria-disabled={runState === 'running'}
          >
            Import setup
            <input
              type="file"
              accept="application/json,.json"
              disabled={runState === 'running'}
              onChange={importScenarios}
            />
          </label>
        </div>
      </header>

      <main className="visualizer-main" id="visualizer-main">
        <section className="visualizer-intro" aria-labelledby="visualizer-title">
          <div>
            <div className="eyebrow">Representative week · paired discrete-event simulation</div>
            <div className="visualizer-title-row">
              <h1 id="visualizer-title">Emergency department flow visualizer</h1>
              <a
                className="primary-button instructions-download"
                href={`${import.meta.env.BASE_URL}instructions/ED_Throughput_Sandbox_Instructions.pdf`}
                download="ED_Throughput_Sandbox_Instructions.pdf"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5" />
                </svg>
                Download Instructions PDF
              </a>
            </div>
            <p>
              Replay one representative synthetic week. Compare median outcomes and 10th–90th
              percentile ranges across repeated simulations.
            </p>
          </div>
          <div className="visualizer-run-summary" aria-label="Run status">
            <span>{phase}</span>
            <strong>{view === 'split' ? 'Baseline + intervention' : scenarios[view].name}</strong>
            <small>
              Seed {scenarios.a.seed.toLocaleString()} · {scenarios.a.replications} replications
            </small>
          </div>
        </section>

        <section className="visualizer-command-bar" aria-label="Visualizer run controls">
          <div className="view-switcher" role="group" aria-label="Scenario view">
            <button
              type="button"
              className={view === 'a' ? 'is-active' : ''}
              onClick={() => selectView('a')}
            >
              A · Baseline
            </button>
            <button
              type="button"
              className={view === 'b' ? 'is-active' : ''}
              onClick={() => selectView('b')}
            >
              B · Intervention
            </button>
            <button
              type="button"
              className={view === 'split' ? 'is-active' : ''}
              onClick={() => selectView('split')}
            >
              Side by side
            </button>
          </div>
          {runState === 'running' ? (
            <div
              className="visualizer-progress"
              role="progressbar"
              aria-valuenow={Math.round(progress * 100)}
            >
              <span style={{ width: `${progress * 100}%` }} />
              <strong>{phase}</strong>
              <small>{Math.round(progress * 100)}%</small>
            </div>
          ) : (
            <div className="guided-steps" aria-label="Simulation workflow">
              <span>
                <b>1</b> Set assumptions
              </span>
              <span>
                <b>2</b> Run
              </span>
              <span>
                <b>3</b> Replay & inspect
              </span>
            </div>
          )}
          <button
            className="text-button setup-toggle"
            type="button"
            onClick={() => setSetupOpen(!setupOpen)}
          >
            {setupOpen ? 'Hide setup' : 'Show setup'}
          </button>
          <button
            className={
              runState === 'running'
                ? 'cancel-button visualizer-run-button'
                : 'primary-button visualizer-run-button'
            }
            type="button"
            onClick={runState === 'running' ? cancel : run}
          >
            {runState === 'running'
              ? 'Cancel run'
              : view === 'split'
                ? 'Run paired week'
                : `Run Scenario ${view.toUpperCase()}`}
          </button>
        </section>

        {error && (
          <div className="persistent-alert visualizer-alert" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => setError(undefined)}>
              Dismiss
            </button>
          </div>
        )}

        {visibleStale && (
          <div className="persistent-alert visualizer-alert visualizer-stale-alert" role="status">
            The visible setup has changed. This replay and its ranges are from the previous
            completed run; rerun before exporting or jumping to an ensemble peak.
          </div>
        )}

        <LiveKpiStrip
          minute={minute}
          view={view}
          states={states}
          results={results}
          traces={traces}
          activeSlot={inspectorSlot}
          stale={visibleStale}
          onJump={jump}
        />

        <section
          className={`visualizer-workspace${setupOpen ? '' : ' setup-collapsed'}${
            view === 'split' ? ' is-split' : ''
          }`}
        >
          {setupOpen && (
            <ScenarioLevers
              scenarios={scenarios}
              activeSlot={editSlot}
              stale={stale}
              disabled={runState === 'running'}
              onSelectSlot={setEditSlot}
              onChange={updateScenario}
              onClone={cloneBaseline}
              onNewSeed={newSeed}
            />
          )}

          <section className="visualizer-stage" aria-labelledby="map-title">
            <div className="stage-heading">
              <div>
                <span className="section-kicker">Simulation replay</span>
                <h2 id="map-title">Emergency department map</h2>
              </div>
              <div className="map-legend" aria-label="Map legend">
                {[1, 2, 3, 4, 5].map((esi) => (
                  <span key={esi}>
                    <i className={`esi-dot esi-${esi}`} /> ESI {esi}
                  </span>
                ))}
                <span>
                  <i className="resource-legend resource-legend--reserved" /> Reserved
                </span>
              </div>
            </div>
            <div className={`department-map-grid${view === 'split' ? ' is-split' : ''}`}>
              {(view === 'a' || view === 'split') && (
                <DepartmentMap
                  state={states.a}
                  title={scenarios.a.name}
                  slot="a"
                  selection={selection}
                  onSelect={setSelection}
                  reducedMotion={reducedMotion}
                  onFocusPane={() => setInspectorSlot('a')}
                />
              )}
              {(view === 'b' || view === 'split') && (
                <DepartmentMap
                  state={states.b}
                  title={scenarios.b.name}
                  slot="b"
                  selection={selection}
                  onSelect={setSelection}
                  reducedMotion={reducedMotion}
                  onFocusPane={() => setInspectorSlot('b')}
                />
              )}
            </div>
          </section>

          <InspectorPanel
            state={states[inspectorSlot]}
            trace={traces[inspectorSlot]}
            selection={selection}
            onSelect={setSelection}
            scenarioLabel={`Scenario ${inspectorSlot.toUpperCase()}`}
            slot={inspectorSlot}
          />
        </section>

        <section className="playback-dock" aria-label="Representative-week playback">
          <div className="player-clock">
            <span>{currentTime.day.toUpperCase()}</span>
            <strong>{currentTime.clock}</strong>
            <small>
              Day {currentTime.dayNumber} of {totalDays}
            </small>
          </div>
          <div className="player-controls" aria-label="Playback controls">
            <button type="button" disabled={!hasTrace} onClick={() => jump(0)}>
              Restart
            </button>
            <button
              type="button"
              disabled={!hasTrace}
              onClick={() => step(-1)}
              aria-label="Previous event"
            >
              −1 event
            </button>
            <button
              type="button"
              disabled={!hasTrace}
              className="player-primary"
              onClick={() => {
                setPlaying((current) => !current);
                setAnnouncement(playing ? 'Replay paused.' : 'Replay playing.');
              }}
            >
              {playing ? 'Pause' : 'Play'}
            </button>
            <button
              type="button"
              disabled={!hasTrace}
              onClick={() => step(1)}
              aria-label="Next event"
            >
              +1 event
            </button>
            <label className="speed-control">
              Speed
              <select
                value={speed}
                disabled={!hasTrace}
                onChange={(event) => setSpeed(Number(event.target.value))}
              >
                <option value="1">1×</option>
                <option value="5">5×</option>
                <option value="30">30×</option>
                <option value="120">120×</option>
              </select>
            </label>
            <button
              type="button"
              disabled={!hasTrace || visibleStale}
              onClick={() => jump(primaryTrace?.peakMinute ?? 0)}
            >
              Jump to peak
            </button>
            <button type="button" disabled={!hasTrace} onClick={addBookmark}>
              Add bookmark
            </button>
          </div>
          <div className="week-scrubber">
            <input
              type="range"
              min="0"
              max={Math.max(1, endMinute)}
              step="1"
              value={minute}
              disabled={!hasTrace}
              aria-label="Week replay position"
              aria-valuetext={currentTime.compact}
              onChange={(event) => {
                setPlaying(false);
                setMinute(Number(event.target.value));
              }}
            />
            <div className="bookmark-lane" aria-label="Bookmarks">
              {bookmarks.map((bookmark) => (
                <button
                  type="button"
                  key={bookmark.id}
                  style={{ left: `${(bookmark.minute / endMinute) * 100}%` }}
                  onClick={() => jump(bookmark.minute)}
                  title={`Jump to ${bookmark.label}`}
                >
                  <span className="sr-only">{bookmark.label}</span>
                </button>
              ))}
            </div>
            <div className="timeline-days" aria-hidden="true">
              {Array.from({ length: totalDays }, (_, index) => {
                const day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index % 7]!;
                return (
                  <span key={`${day}-${index}`}>{totalDays > 7 ? `${day} ${index + 1}` : day}</span>
                );
              })}
            </div>
          </div>
        </section>

        <EvidencePanel
          results={results}
          comparison={payload?.comparison}
          view={view}
          trace={primaryTrace}
          seriesMetric={seriesMetric}
          stale={visibleStale}
          onSeriesMetric={setSeriesMetric}
          onExport={exportResults}
        />
      </main>

      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button type="button" onClick={() => setToast(undefined)} aria-label="Dismiss message">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
