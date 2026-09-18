/// <reference lib="webworker" />

import {
  aggregateReplicationsV2,
  comparisonResultV2,
  demandIsPairedV2,
} from '../simulation/v2/aggregate';
import { runReplicationV2 } from '../simulation/v2/engine';
import { selectRepresentativeV2 } from '../simulation/v2/representative';
import type {
  AggregateResultV2,
  ReplicationSummaryV2,
  VisualizerRunPayloadV2,
} from '../simulation/v2/types';
import { sharedRunSettingsErrorV2, validateScenarioV2 } from '../simulation/v2/validation';
import type {
  VisualizerRunRequestV2,
  VisualizerSlotV2,
  VisualizerWorkerResponseV2,
} from '../simulation/v2/workerProtocol';

const worker = self as unknown as DedicatedWorkerGlobalScope;

function post(message: VisualizerWorkerResponseV2): void {
  worker.postMessage(message);
}

worker.addEventListener('message', (event: MessageEvent<VisualizerRunRequestV2>) => {
  const message = event.data;
  if (message.type !== 'v2/run') return;
  try {
    post({
      type: 'v2/progress',
      runId: message.runId,
      phase: 'validating',
      completed: 0,
      total: 1,
      progress: 0,
    });
    const validatedA = validateScenarioV2(message.scenarios.a);
    const validatedB = validateScenarioV2(message.scenarios.b);
    if (!validatedA.ok) throw new Error(`Baseline: ${validatedA.error}`);
    if (!validatedB.ok) throw new Error(`Intervention: ${validatedB.error}`);
    const sharedSettingsError = sharedRunSettingsErrorV2(validatedA.value, validatedB.value);
    if (sharedSettingsError) throw new Error(sharedSettingsError);
    const scenarios = { a: validatedA.value, b: validatedB.value };
    const count = scenarios.a.replications;
    const total = count * message.slots.length + message.slots.length;
    let completed = 0;
    const raw: Partial<Record<VisualizerSlotV2, ReplicationSummaryV2[]>> = {};
    const results: Partial<Record<VisualizerSlotV2, AggregateResultV2>> = {};

    for (const slot of message.slots) {
      const slotStarted = performance.now();
      const values: ReplicationSummaryV2[] = [];
      for (let replication = 0; replication < count; replication += 1) {
        values.push(runReplicationV2(scenarios[slot], replication));
        completed += 1;
        if (completed % 2 === 0 || completed === total) {
          post({
            type: 'v2/progress',
            runId: message.runId,
            phase: 'ensemble',
            completed,
            total,
            progress: completed / total,
          });
        }
      }
      raw[slot] = values;
      results[slot] = aggregateReplicationsV2(
        scenarios[slot],
        values,
        performance.now() - slotStarted,
      );
    }

    post({
      type: 'v2/progress',
      runId: message.runId,
      phase: 'selecting',
      completed,
      total,
      progress: completed / total,
    });
    const pairing = demandIsPairedV2(scenarios.a, scenarios.b) ? 'patient' : 'replicationOnly';
    const selection = selectRepresentativeV2(
      raw.a ?? raw.b!,
      raw.a && raw.b ? raw.b : undefined,
      pairing,
    );
    const traces: VisualizerRunPayloadV2['representative']['traces'] = {};
    for (const slot of message.slots) {
      const traced = runReplicationV2(scenarios[slot], selection.replication, {
        recordTrace: true,
        selection,
      });
      if (!traced.trace) throw new Error('Representative trace was not produced.');
      traces[slot] = traced.trace;
      completed += 1;
      post({
        type: 'v2/progress',
        runId: message.runId,
        phase: 'tracing',
        completed,
        total,
        progress: completed / total,
      });
    }

    let comparison;
    if (results.a && results.b && raw.a && raw.b) {
      comparison = comparisonResultV2(results.a, results.b, raw.a, raw.b);
    }
    post({
      type: 'v2/result',
      runId: message.runId,
      payload: {
        results,
        comparison,
        representative: { replication: selection.replication, pairing, traces },
      },
    });
  } catch (error) {
    post({
      type: 'v2/error',
      runId: message.runId,
      code: 'VISUALIZER_RUN_FAILED',
      message:
        error instanceof Error ? error.message : 'The visualizer run could not be completed.',
    });
  }
});

export {};
