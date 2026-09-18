import type { ReplayStateV2, SimulationTraceV2, TraceFrameV2 } from './types';

function cloneState(state: ReplayStateV2): ReplayStateV2 {
  return structuredClone(state);
}

function applyFrame(state: ReplayStateV2, frame: TraceFrameV2): void {
  for (const patch of frame.patches) {
    if (patch.kind === 'upsertPatient') {
      state.patients[String(patch.patient.id)] = structuredClone(patch.patient);
    } else if (patch.kind === 'removePatient') {
      delete state.patients[String(patch.patientId)];
    } else {
      state.resources[patch.resource.id] = structuredClone(patch.resource);
    }
  }
  state.live = structuredClone(frame.live);
  state.minute = frame.minute;
}

export function frameIndexAtOrBefore(trace: SimulationTraceV2, minute: number): number {
  let low = 0;
  let high = trace.frames.length - 1;
  let answer = -1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (trace.frames[middle]!.minute <= minute) {
      answer = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return answer;
}

export function snapshotAtV2(trace: SimulationTraceV2, requestedMinute: number): ReplayStateV2 {
  const minute = Math.max(0, Math.min(trace.window.endMinute, requestedMinute));
  let checkpoint = trace.initial;
  for (const candidate of trace.checkpoints) {
    if (candidate.minute <= minute && candidate.frameIndex >= checkpoint.frameIndex)
      checkpoint = candidate;
    if (candidate.minute > minute) break;
  }
  const state = cloneState(checkpoint.state);
  const targetFrame = frameIndexAtOrBefore(trace, minute);
  for (let index = checkpoint.frameIndex + 1; index <= targetFrame; index += 1) {
    applyFrame(state, trace.frames[index]!);
  }
  for (const patient of Object.values(state.patients)) {
    if (!patient.active) continue;
    patient.losMinutes = Math.max(0, minute - patient.arrivalMinute);
    if (patient.disposition == null && patient.assignedTreatmentResourceId == null) {
      patient.waitMinutes = Math.max(0, minute - patient.arrivalMinute);
    }
  }
  state.minute = minute;
  return state;
}

export function adjacentFrameMinuteV2(
  trace: SimulationTraceV2,
  currentMinute: number,
  direction: -1 | 1,
): number {
  if (direction === 1) {
    return (
      trace.frames.find((frame) => frame.minute > currentMinute)?.minute ?? trace.window.endMinute
    );
  }
  for (let index = trace.frames.length - 1; index >= 0; index -= 1) {
    if (trace.frames[index]!.minute < currentMinute) return trace.frames[index]!.minute;
  }
  return 0;
}
