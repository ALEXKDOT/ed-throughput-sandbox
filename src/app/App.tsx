import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Header } from '../components/Header';
import { cloneScenario, DEFAULT_SCENARIO, PRESETS, type PresetKey } from '../presets/scenarios';
import { resolveHourlyProfile } from '../presets/profiles';
import type {
  AggregateResult,
  ComparisonResult,
  ScenarioBundle,
  ScenarioConfig,
  SensitivityOutcome,
  SensitivityParameter,
  SensitivityResult,
} from '../simulation/types';
import { parseBundle, validateBundle, validateScenario } from '../simulation/validation';
import { reverseDeltaInterval } from '../simulation/aggregate';
import { AssumptionsPanel } from '../features/controls/AssumptionsPanel';
import { ScenarioBar } from '../features/controls/ScenarioBar';
import { MethodologyDialog } from '../features/methodology/MethodologyDialog';
import { ResultsDashboard } from '../features/results/ResultsDashboard';
import {
  decodeBundle,
  downloadText,
  encodeBundle,
  resultsCsv,
  stableScenarioKey,
} from '../utilities/portability';

type Slot = 'a' | 'b';
type RunState = 'idle' | 'running' | 'complete' | 'cancelled' | 'error';

interface CachedRun {
  results: Partial<Record<Slot, AggregateResult>>;
  comparison?: ComparisonResult;
}

const resultCache = new Map<string, CachedRun>();
const STORAGE_KEY = 'ed-throughput-sandbox.bundle.v1';
const SensitivityDialog = lazy(async () => {
  const module = await import('../features/sensitivity/SensitivityDialog');
  return { default: module.SensitivityDialog };
});

function defaultBundle(): ScenarioBundle {
  return {
    schemaVersion: 1,
    scenarios: {
      a: cloneScenario(DEFAULT_SCENARIO),
      b: { ...cloneScenario(DEFAULT_SCENARIO), name: 'Intervention' },
    },
    activeScenario: 'a',
  };
}

function initialState(): { bundle: ScenarioBundle; notice?: string } {
  const fallback = defaultBundle();
  try {
    const shared = new URLSearchParams(window.location.search).get('state');
    if (shared) {
      const decoded = decodeBundle(shared);
      if (decoded.ok) return { bundle: decoded.value };
      return { bundle: fallback, notice: `${decoded.error} Loaded the balanced baseline instead.` };
    }
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = parseBundle(saved);
      if (parsed.ok) return { bundle: parsed.value };
      return { bundle: fallback, notice: 'Saved assumptions were invalid and were not loaded.' };
    }
  } catch {
    return {
      bundle: fallback,
      notice: 'Browser storage was unavailable; changes will last for this session.',
    };
  }
  return { bundle: fallback };
}

function sameScenario(a: ScenarioConfig, b: ScenarioConfig): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function importNormalizesAcuity(text: string): boolean {
  try {
    const value = JSON.parse(text) as unknown;
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const scenarios = (value as Record<string, unknown>).scenarios;
    if (typeof scenarios !== 'object' || scenarios === null || Array.isArray(scenarios))
      return false;
    return (['a', 'b'] as const).some((slot) => {
      const scenario = (scenarios as Record<string, unknown>)[slot];
      if (typeof scenario !== 'object' || scenario === null || Array.isArray(scenario))
        return false;
      const mix = (scenario as Record<string, unknown>).acuityMix;
      if (typeof mix !== 'object' || mix === null || Array.isArray(mix)) return false;
      const values = ['high', 'moderate', 'low'].map(
        (tier) => (mix as Record<string, unknown>)[tier],
      );
      return (
        values.every((item): item is number => typeof item === 'number' && Number.isFinite(item)) &&
        Math.abs(values.reduce((sum, item) => sum + item, 0) - 1) > 1e-9
      );
    });
  } catch {
    return false;
  }
}

export function App() {
  const initial = useMemo(initialState, []);
  const [bundle, setBundle] = useState<ScenarioBundle>(initial.bundle);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [results, setResults] = useState<Partial<Record<Slot, AggregateResult>>>({});
  const [comparison, setComparison] = useState<ComparisonResult>();
  const [runState, setRunState] = useState<RunState>('idle');
  const [runTargets, setRunTargets] = useState<Slot[]>([]);
  const [runAnnouncement, setRunAnnouncement] = useState('');
  const [progress, setProgress] = useState(0);
  const [toast, setToast] = useState<string>();
  const [startupNotice, setStartupNotice] = useState<string | undefined>(initial.notice);
  const [methodologyOpen, setMethodologyOpen] = useState(false);
  const [sensitivityOpen, setSensitivityOpen] = useState(false);
  const [sensitivityState, setSensitivityState] = useState<RunState>('idle');
  const [sensitivityProgress, setSensitivityProgress] = useState(0);
  const [sensitivityResult, setSensitivityResult] = useState<SensitivityResult>();
  const [sensitivityError, setSensitivityError] = useState<string>();
  const [sensitivityAnnouncement, setSensitivityAnnouncement] = useState('');
  const [runError, setRunError] = useState<string>();
  const [importError, setImportError] = useState<string>();
  const workerRef = useRef<Worker | null>(null);
  const sensitivityWorkerRef = useRef<Worker | null>(null);
  const runIdRef = useRef('');
  const sensitivityRunIdRef = useRef('');
  const active = bundle.activeScenario;

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, stableScenarioKey(bundle));
    } catch {
      // The application remains fully usable when storage is unavailable.
    }
  }, [bundle]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(undefined), 7000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      sensitivityWorkerRef.current?.terminate();
    },
    [],
  );

  const stale = {
    a: Boolean(results.a && !sameScenario(results.a.scenario, bundle.scenarios.a)),
    b: Boolean(results.b && !sameScenario(results.b.scenario, bundle.scenarios.b)),
  };

  const updateActiveScenario = (scenario: ScenarioConfig) => {
    setBundle((current) => ({
      ...current,
      scenarios: { ...current.scenarios, [current.activeScenario]: scenario },
    }));
  };

  const updateGlobalSettings = (settings: { replications?: number; seed?: number }) => {
    setBundle((current) => ({
      ...current,
      scenarios: {
        a: { ...current.scenarios.a, ...settings },
        b: { ...current.scenarios.b, ...settings },
      },
    }));
  };

  const applyPreset = (key: PresetKey) => {
    const preset = cloneScenario(PRESETS[key]);
    preset.seed = bundle.scenarios.a.seed;
    preset.replications = bundle.scenarios.a.replications;
    updateActiveScenario(preset);
    setToast(`${preset.name} applied. This is an illustrative synthetic scenario.`);
  };

  const newSeed = () => {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    updateGlobalSettings({ seed: values[0] || 1 });
    setToast('New shared master seed created. Run again to update results.');
  };

  const duplicate = () => {
    const initialB = { ...cloneScenario(DEFAULT_SCENARIO), name: 'Intervention' };
    if (
      (!sameScenario(bundle.scenarios.b, initialB) || results.b) &&
      !window.confirm(
        'Replace Scenario B with a copy of Scenario A? Existing Scenario B assumptions and results will be replaced.',
      )
    ) {
      return;
    }
    setBundle((current) => ({
      ...current,
      activeScenario: 'b',
      scenarios: {
        ...current.scenarios,
        b: { ...cloneScenario(current.scenarios.a), name: 'Intervention' },
      },
    }));
    setResults((current) => ({ a: current.a }));
    setComparison(undefined);
    setComparisonMode(true);
    setToast('Scenario A duplicated into Scenario B. Change one assumption, then run both.');
  };

  const swap = () => {
    setBundle((current) => ({
      ...current,
      scenarios: { a: current.scenarios.b, b: current.scenarios.a },
      activeScenario: current.activeScenario === 'a' ? 'b' : 'a',
    }));
    setResults((current) => ({ a: current.b, b: current.a }));
    setComparison((current) =>
      current
        ? {
            a: current.b,
            b: current.a,
            deltas: Object.fromEntries(
              Object.entries(current.deltas).map(([key, value]) => [
                key,
                reverseDeltaInterval(value),
              ]),
            ) as ComparisonResult['deltas'],
            percentDeltas: current.reversePercentDeltas,
            reversePercentDeltas: current.percentDeltas,
          }
        : undefined,
    );
    setToast('Scenario A and B were swapped.');
  };

  const runSimulation = () => {
    const slots: Slot[] = comparisonMode ? ['a', 'b'] : [active];
    const validated = validateBundle(bundle);
    if (!validated.ok) {
      setRunState('error');
      setRunError(`Assumptions are invalid: ${validated.error}`);
      return;
    }
    setBundle(validated.value);
    setImportError(undefined);
    const scenarios = validated.value.scenarios;
    setRunTargets(slots);
    setRunAnnouncement('');
    runIdRef.current = '';
    workerRef.current?.terminate();
    workerRef.current = null;
    const cacheKey = JSON.stringify({ slots, scenarios });
    const cached = resultCache.get(cacheKey);
    if (cached) {
      setResults((current) => ({ ...current, ...cached.results }));
      setComparison(cached.comparison);
      setRunState('complete');
      setProgress(1);
      setToast('Loaded identical completed results from this session.');
      return;
    }

    const worker = new Worker(new URL('../workers/simulation.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;
    const runId = crypto.randomUUID();
    runIdRef.current = runId;
    setRunState('running');
    setRunError(undefined);
    setProgress(0);

    worker.addEventListener('message', (event: MessageEvent<Record<string, unknown>>) => {
      if (event.data.runId !== runIdRef.current) return;
      if (event.data.type === 'progress') {
        setProgress(Number(event.data.progress));
      } else if (event.data.type === 'result') {
        const incoming = event.data.results as Partial<Record<Slot, AggregateResult>>;
        const incomingComparison = event.data.comparison as ComparisonResult | undefined;
        setResults((current) => ({ ...current, ...incoming }));
        setComparison(incomingComparison);
        setRunState('complete');
        setProgress(1);
        resultCache.set(cacheKey, { results: incoming, comparison: incomingComparison });
        setRunAnnouncement(
          slots.length === 2
            ? 'Simulation complete. Comparison results for Scenario A and Scenario B are ready.'
            : `Simulation complete. Results for Scenario ${slots[0]!.toUpperCase()} are ready.`,
        );
        worker.terminate();
        if (workerRef.current === worker) workerRef.current = null;
      } else if (event.data.type === 'error') {
        const message = String(event.data.error ?? 'The simulation could not be completed.');
        setRunState('error');
        setRunError(message);
        worker.terminate();
        if (workerRef.current === worker) workerRef.current = null;
      }
    });
    worker.addEventListener('error', () => {
      if (runIdRef.current !== runId) return;
      setRunState('error');
      setRunError('The simulation worker stopped unexpectedly. No partial results were published.');
    });
    worker.postMessage({ type: 'run', runId, scenarios, slots });
  };

  const cancelRun = () => {
    runIdRef.current = '';
    workerRef.current?.terminate();
    workerRef.current = null;
    setRunState('cancelled');
    setProgress(0);
  };

  const share = async () => {
    const validated = validateBundle(bundle);
    if (!validated.ok) {
      setImportError(`Share blocked: ${validated.error}`);
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set('state', encodeBundle(validated.value));
    window.history.replaceState({}, '', url);
    try {
      await navigator.clipboard.writeText(url.toString());
      setToast(
        'Share link copied. It contains assumptions only—never simulation results or patient data.',
      );
    } catch {
      setToast('Share link is now in the address bar. Copy it from there to share.');
    }
  };

  const exportJson = () => {
    const validated = validateBundle(bundle);
    if (!validated.ok) {
      setImportError(`Export blocked: ${validated.error}`);
      return;
    }
    const exported = {
      ...validated.value,
      exportedAt: new Date().toISOString(),
      derived: {
        note: 'Audit-only derived values; imports reconstruct them from the validated scenario inputs.',
        normalizedHourlyArrivalMultipliers: {
          a: resolveHourlyProfile(
            validated.value.scenarios.a.arrivalProfile,
            validated.value.scenarios.a.customArrivalBlocks,
          ),
          b: resolveHourlyProfile(
            validated.value.scenarios.b.arrivalProfile,
            validated.value.scenarios.b.customArrivalBlocks,
          ),
        },
      },
    };
    downloadText(
      'ed-throughput-scenarios.json',
      JSON.stringify(exported, null, 2),
      'application/json',
    );
    setToast('Scenario assumptions exported as JSON.');
  };

  const importJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 65_536) {
      setImportError('Import rejected: scenario files must be 64 KB or smaller.');
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      setImportError(
        'Import rejected: the file could not be read. Existing assumptions were not changed.',
      );
      return;
    }
    const parsed = parseBundle(text);
    if (!parsed.ok) {
      setImportError(`Import rejected: ${parsed.error} Existing assumptions were not changed.`);
      return;
    }
    if (
      !window.confirm(
        'Import this scenario bundle? It will replace both current scenarios and clear completed results.',
      )
    ) {
      setToast('Import cancelled. Existing assumptions were not changed.');
      return;
    }
    setImportError(undefined);
    setBundle(parsed.value);
    runIdRef.current = '';
    workerRef.current?.terminate();
    workerRef.current = null;
    sensitivityRunIdRef.current = '';
    sensitivityWorkerRef.current?.terminate();
    sensitivityWorkerRef.current = null;
    setResults({});
    setComparison(undefined);
    setRunState('idle');
    setRunTargets([]);
    setRunAnnouncement('');
    setSensitivityState('idle');
    setSensitivityResult(undefined);
    setSensitivityAnnouncement('');
    setToast(
      importNormalizesAcuity(text)
        ? 'Scenario bundle imported. Acuity values were normalized to sum to 100%. Run the simulation to calculate results.'
        : 'Scenario bundle imported and validated. Run the simulation to calculate results.',
    );
  };

  const exportCsv = () => {
    const sections = (['a', 'b'] as const)
      .filter((slot) => results[slot] && (comparisonMode || slot === active))
      .map((slot, index) =>
        resultsCsv(
          `Scenario ${slot.toUpperCase()}: ${results[slot]!.scenario.name}`,
          results[slot]!,
          index === 0,
        ),
      );
    if (sections.length === 0) return;
    downloadText('ed-throughput-results.csv', sections.join('\n'), 'text/csv;charset=utf-8');
    setToast('Summary metrics and time-series results exported as CSV.');
  };

  const runSensitivity = (parameter: SensitivityParameter, outcome: SensitivityOutcome) => {
    const validated = validateScenario(bundle.scenarios[active]);
    if (!validated.ok) {
      setSensitivityState('error');
      setSensitivityError(`Assumptions are invalid: ${validated.error}`);
      return;
    }
    setBundle((current) => ({
      ...current,
      scenarios: { ...current.scenarios, [active]: validated.value },
    }));
    sensitivityWorkerRef.current?.terminate();
    const worker = new Worker(new URL('../workers/simulation.worker.ts', import.meta.url), {
      type: 'module',
    });
    sensitivityWorkerRef.current = worker;
    const runId = crypto.randomUUID();
    sensitivityRunIdRef.current = runId;
    setSensitivityState('running');
    setSensitivityAnnouncement('');
    setSensitivityError(undefined);
    setSensitivityProgress(0);
    worker.addEventListener('message', (event: MessageEvent<Record<string, unknown>>) => {
      if (event.data.runId !== sensitivityRunIdRef.current) return;
      if (event.data.type === 'progress') setSensitivityProgress(Number(event.data.progress));
      if (event.data.type === 'sensitivityResult') {
        setSensitivityResult(event.data.result as SensitivityResult);
        setSensitivityState('complete');
        setSensitivityProgress(1);
        setSensitivityAnnouncement(
          'Sensitivity analysis complete. Results are ready in the sensitivity explorer.',
        );
        worker.terminate();
      }
      if (event.data.type === 'error') {
        const message = String(event.data.error ?? 'Sensitivity analysis could not be completed.');
        setSensitivityState('error');
        setSensitivityError(message);
        worker.terminate();
      }
    });
    worker.postMessage({
      type: 'sensitivity',
      runId,
      scenario: validated.value,
      parameter,
      outcome,
    });
  };

  const cancelSensitivity = () => {
    sensitivityRunIdRef.current = '';
    sensitivityWorkerRef.current?.terminate();
    setSensitivityState('cancelled');
    setSensitivityProgress(0);
  };

  const exportSensitivity = () => {
    if (!sensitivityResult) return;
    const rows = [
      [
        'parameter',
        'value',
        'outcome',
        'median',
        'p10',
        'p90',
        'valid_replications',
        'replications_per_point',
        'seed',
        'algorithm_version',
      ],
      ...sensitivityResult.points.map((point) => [
        sensitivityResult.parameter,
        point.value,
        sensitivityResult.outcome,
        point.outcome.median ?? '',
        point.outcome.low ?? '',
        point.outcome.high ?? '',
        point.outcome.n,
        sensitivityResult.replicationsPerPoint,
        sensitivityResult.seed,
        sensitivityResult.algorithmVersion,
      ]),
    ];
    downloadText(
      'ed-throughput-sensitivity.csv',
      rows.map((row) => row.join(',')).join('\n'),
      'text/csv;charset=utf-8',
    );
  };

  return (
    <div className="app-shell">
      <p className="sr-only" role="status" aria-atomic="true">
        {runAnnouncement}
      </p>
      <p className="sr-only" role="status" aria-atomic="true">
        {sensitivityAnnouncement}
      </p>
      <Header
        onMethodology={() => setMethodologyOpen(true)}
        onSensitivity={() => setSensitivityOpen(true)}
      />
      <ScenarioBar
        bundle={bundle}
        active={active}
        comparisonMode={comparisonMode}
        runState={runState}
        progress={progress}
        runningSlots={runTargets}
        stale={stale}
        hasResult={{ a: Boolean(results.a), b: Boolean(results.b) }}
        onSelect={(slot) => setBundle((current) => ({ ...current, activeScenario: slot }))}
        onRename={(name) => {
          const safe = Array.from(name)
            .filter((character) => {
              const code = character.charCodeAt(0);
              return code >= 32 && code !== 127;
            })
            .join('')
            .slice(0, 48);
          if (safe.trim()) updateActiveScenario({ ...bundle.scenarios[active], name: safe });
        }}
        onDuplicate={duplicate}
        onSwap={swap}
        onCompare={() => setComparisonMode((value) => !value)}
        onRun={runSimulation}
        onCancel={cancelRun}
        onShare={share}
        onExportJson={exportJson}
        onImport={importJson}
        onReset={() => {
          if (
            window.confirm(
              `Reset Scenario ${active.toUpperCase()} to the balanced synthetic baseline? Its current assumptions will be replaced.`,
            )
          ) {
            applyPreset('balanced');
          }
        }}
      />
      {startupNotice && (
        <div className="persistent-alert persistent-alert--info" role="status">
          <span>{startupNotice}</span>
          <button type="button" onClick={() => setStartupNotice(undefined)}>
            Dismiss
          </button>
        </div>
      )}
      {importError && (
        <div className="persistent-alert" role="alert">
          <span>{importError}</span>
          <button type="button" onClick={() => setImportError(undefined)}>
            Dismiss
          </button>
        </div>
      )}
      <main id="main-content" className="workspace">
        <AssumptionsPanel
          scenario={bundle.scenarios[active]}
          onChange={updateActiveScenario}
          onGlobalSettings={updateGlobalSettings}
          onPreset={applyPreset}
          onNewSeed={newSeed}
          running={runState === 'running'}
        />
        <ResultsDashboard
          active={active}
          results={results}
          comparison={comparison}
          comparisonMode={comparisonMode}
          stale={comparisonMode && comparison ? stale.a || stale.b : stale[active]}
          runState={runState}
          runError={runError}
          onRun={runSimulation}
          onExportCsv={exportCsv}
          onPrint={() => window.print()}
        />
      </main>
      <footer className="site-footer">
        <div>
          <strong>ED Throughput Sandbox</strong>
          <span>Open-source educational systems modeling</span>
        </div>
        <p>
          This application is an educational systems-modeling project. It uses synthetic inputs and
          simplified assumptions, is not calibrated to any institution, and should not be used for
          staffing, clinical, regulatory, or operational decisions.
        </p>
        <button type="button" className="text-button" onClick={() => setMethodologyOpen(true)}>
          Read methodology and sources
        </button>
      </footer>
      <div className="mobile-run-dock print-hidden">
        <button
          type="button"
          className={runState === 'running' ? 'cancel-button' : 'primary-button'}
          onClick={runState === 'running' ? cancelRun : runSimulation}
        >
          {runState === 'running'
            ? `Cancel run · ${Math.round(progress * 100)}%`
            : comparisonMode
              ? 'Run both scenarios'
              : `Run Scenario ${active.toUpperCase()}`}
        </button>
        {results[active] && runState !== 'running' && (
          <a className="secondary-button" href="#results-title">
            View results
          </a>
        )}
      </div>
      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <span>{toast}</span>
          <button type="button" onClick={() => setToast(undefined)} aria-label="Dismiss message">
            ×
          </button>
        </div>
      )}
      <MethodologyDialog
        open={methodologyOpen}
        scenario={bundle.scenarios[active]}
        onClose={() => setMethodologyOpen(false)}
      />
      {sensitivityOpen && (
        <Suspense
          fallback={
            <div className="dialog-loading" role="status">
              Opening sensitivity explorer…
            </div>
          }
        >
          <SensitivityDialog
            open={sensitivityOpen}
            status={sensitivityState}
            progress={sensitivityProgress}
            result={sensitivityResult}
            resultStale={Boolean(
              sensitivityResult &&
              sensitivityResult.scenarioKey !== JSON.stringify(bundle.scenarios[active]),
            )}
            error={sensitivityError}
            onClose={() => setSensitivityOpen(false)}
            onRun={runSensitivity}
            onCancel={cancelSensitivity}
            onExport={exportSensitivity}
          />
        </Suspense>
      )}
    </div>
  );
}
