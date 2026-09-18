import type { ScenarioConfigV2, VisualizerRunPayloadV2 } from './types';

export type VisualizerSlotV2 = 'a' | 'b';

export interface VisualizerRunRequestV2 {
  type: 'v2/run';
  runId: string;
  scenarios: Record<VisualizerSlotV2, ScenarioConfigV2>;
  slots: VisualizerSlotV2[];
}

export type VisualizerWorkerResponseV2 =
  | {
      type: 'v2/progress';
      runId: string;
      phase: 'validating' | 'ensemble' | 'selecting' | 'tracing' | 'aggregating';
      completed: number;
      total: number;
      progress: number;
    }
  | { type: 'v2/result'; runId: string; payload: VisualizerRunPayloadV2 }
  | { type: 'v2/error'; runId: string; code: string; message: string };
