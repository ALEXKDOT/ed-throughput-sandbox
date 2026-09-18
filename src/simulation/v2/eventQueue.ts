import type { Disposition, ServiceKind } from './types';

export type EngineEventV2 =
  | {
      kind: 'serviceComplete';
      time: number;
      sequence: number;
      patientId: number;
      service: ServiceKind;
      resourceId: string;
    }
  | {
      kind: 'boardingComplete';
      time: number;
      sequence: number;
      patientId: number;
    }
  | {
      kind: 'exitDeadline';
      time: number;
      sequence: number;
      patientId: number;
      disposition: Extract<Disposition, 'lwbs' | 'lbtc' | 'elope'>;
    }
  | {
      kind: 'interventionApply';
      time: number;
      sequence: number;
      interventionId: string;
    }
  | { kind: 'arrival'; time: number; sequence: number; patientId: number };

const EVENT_PRIORITY: Record<EngineEventV2['kind'], number> = {
  serviceComplete: 0,
  boardingComplete: 0,
  exitDeadline: 1,
  interventionApply: 2,
  arrival: 3,
};

function precedes(a: EngineEventV2, b: EngineEventV2): boolean {
  if (a.time !== b.time) return a.time < b.time;
  const priorityDifference = EVENT_PRIORITY[a.kind] - EVENT_PRIORITY[b.kind];
  if (priorityDifference !== 0) return priorityDifference < 0;
  return a.sequence < b.sequence;
}

export class EventQueueV2 {
  private values: EngineEventV2[] = [];

  get size(): number {
    return this.values.length;
  }

  push(event: EngineEventV2): void {
    this.values.push(event);
    let index = this.values.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (!precedes(this.values[index]!, this.values[parent]!)) break;
      [this.values[index], this.values[parent]] = [this.values[parent]!, this.values[index]!];
      index = parent;
    }
  }

  pop(): EngineEventV2 | undefined {
    if (this.values.length === 0) return undefined;
    const first = this.values[0]!;
    const last = this.values.pop()!;
    if (this.values.length > 0) {
      this.values[0] = last;
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (left < this.values.length && precedes(this.values[left]!, this.values[smallest]!)) {
          smallest = left;
        }
        if (right < this.values.length && precedes(this.values[right]!, this.values[smallest]!)) {
          smallest = right;
        }
        if (smallest === index) break;
        [this.values[index], this.values[smallest]] = [this.values[smallest]!, this.values[index]!];
        index = smallest;
      }
    }
    return first;
  }
}
