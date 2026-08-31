/// <reference lib="webworker" />

import {
  aggregatePairedDeltas,
  aggregatePairedPercentDeltas,
  aggregateReplications,
} from '../simulation/aggregate';
import { DISTRIBUTION_ALGORITHM_VERSION } from '../simulation/distributions';
import { runReplication } from '../simulation/engine';
import { RNG_ALGORITHM_VERSION } from '../simulation/random';
import {
  sensitivityReferenceValue,
  sensitivityValues,
  withSensitivityValue,
} from '../simulation/sensitivity';
import type {
  AggregateResult,
  ComparisonResult,
  ReplicationResult,
  ScenarioConfig,
  SensitivityOutcome,
  SensitivityParameter,
  SensitivityResult,
} from '../simulation/types';
import { validateScenario } from '../simulation/validation';

type Slot = 'a' | 'b';

interface RunMessage {
  type: 'run';
  runId: string;
  scenarios: Record<Slot, ScenarioConfig>;
  slots: Slot[];
}

interface SensitivityMessage {
  type: 'sensitivity';
  runId: string;
  scenario: ScenarioConfig;
  parameter: SensitivityParameter;
  outcome: SensitivityOutcome;
}

type IncomingMessage = RunMessage | SensitivityMessage;

const worker = self as unknown as DedicatedWorkerGlobalScope;

function postProgress(runId: string, completed: number, total: number): void {
  worker.postMessage({ type: 'progress', runId, progress: completed / total });
}

function runScenario(
  scenario: ScenarioConfig,
  replicationCount: number,
  onReplication: () => void,
): ReplicationResult[] {
  return Array.from({ length: replicationCount }, (_, replication) => {
    const result = runReplication(scenario, replication);
    onReplication();
    return result;
  });
}

worker.addEventListener('message', (event: MessageEvent<IncomingMessage>) => {
  const message = event.data;
  try {
    if (message.type === 'run') {
      const started = performance.now();
      const validatedA = validateScenario(message.scenarios.a);
      const validatedB = validateScenario(message.scenarios.b);
      if (!validatedA.ok) throw new Error(`Scenario A: ${validatedA.error}`);
      if (!validatedB.ok) throw new Error(`Scenario B: ${validatedB.error}`);
      const scenarios = { a: validatedA.value, b: validatedB.value };
      if (
        scenarios.a.seed !== scenarios.b.seed ||
        scenarios.a.replications !== scenarios.b.replications
      ) {
        throw new Error('Scenario A and B must share one master seed and replication count.');
      }
      const sharedReplicationCount = scenarios.a.replications;
      const total = sharedReplicationCount * message.slots.length;
      let completed = 0;
      const raw: Partial<Record<Slot, ReplicationResult[]>> = {};
      const results: Partial<Record<Slot, AggregateResult>> = {};

      for (const slot of message.slots) {
        const synchronizedScenario = scenarios[slot];
        const values = runScenario(synchronizedScenario, sharedReplicationCount, () => {
          completed += 1;
          if (completed === total || completed % 5 === 0)
            postProgress(message.runId, completed, total);
        });
        raw[slot] = values;
        results[slot] = aggregateReplications(
          synchronizedScenario,
          values,
          performance.now() - started,
        );
      }

      let comparison: ComparisonResult | undefined;
      if (raw.a && raw.b && results.a && results.b) {
        comparison = {
          a: results.a,
          b: results.b,
          deltas: aggregatePairedDeltas(raw.a, raw.b),
          percentDeltas: aggregatePairedPercentDeltas(raw.a, raw.b),
          reversePercentDeltas: aggregatePairedPercentDeltas(raw.b, raw.a),
        };
      }
      worker.postMessage({ type: 'result', runId: message.runId, results, comparison });
      return;
    }

    const validatedScenario = validateScenario(message.scenario);
    if (!validatedScenario.ok) throw new Error(validatedScenario.error);
    const scenario = validatedScenario.value;
    const started = performance.now();
    const values = sensitivityValues(scenario, message.parameter);
    const replicationsPerPoint = Math.max(20, Math.min(40, Math.round(scenario.replications / 3)));
    const total = values.length * replicationsPerPoint;
    let completed = 0;
    const points = values.map((value) => {
      const pointScenario = withSensitivityValue(scenario, message.parameter, value);
      const validatedPoint = validateScenario(pointScenario);
      if (!validatedPoint.ok) {
        throw new Error(`Sensitivity point ${value} is invalid: ${validatedPoint.error}`);
      }
      const replications = runScenario(validatedPoint.value, replicationsPerPoint, () => {
        completed += 1;
        if (completed === total || completed % 5 === 0)
          postProgress(message.runId, completed, total);
      });
      const aggregate = aggregateReplications(validatedPoint.value, replications, 0);
      return { value, outcome: aggregate.metrics[message.outcome] };
    });
    const result: SensitivityResult = {
      scenarioName: scenario.name,
      scenarioKey: JSON.stringify(scenario),
      parameter: message.parameter,
      outcome: message.outcome,
      baselineValue: sensitivityReferenceValue(scenario, message.parameter),
      replicationsPerPoint,
      seed: scenario.seed,
      algorithmVersion: `edts-model-v1 | ${RNG_ALGORITHM_VERSION} | ${DISTRIBUTION_ALGORITHM_VERSION}`,
      points,
      elapsedMilliseconds: performance.now() - started,
    };
    worker.postMessage({ type: 'sensitivityResult', runId: message.runId, result });
  } catch (error) {
    worker.postMessage({
      type: 'error',
      runId: message.runId,
      error: error instanceof Error ? error.message : 'The simulation could not be completed.',
    });
  }
});

export {};
