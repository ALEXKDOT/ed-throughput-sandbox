export type EventKind = 'boardingComplete' | 'treatmentComplete' | 'arrival' | 'sample';

export interface SimulationEvent {
  time: number;
  kind: EventKind;
  sequence: number;
  patientId?: number;
}

const PRIORITY: Record<EventKind, number> = {
  boardingComplete: 0,
  treatmentComplete: 1,
  arrival: 2,
  sample: 3,
};

function precedes(a: SimulationEvent, b: SimulationEvent): boolean {
  if (a.time !== b.time) return a.time < b.time;
  if (PRIORITY[a.kind] !== PRIORITY[b.kind]) return PRIORITY[a.kind] < PRIORITY[b.kind];
  return a.sequence < b.sequence;
}

export class EventQueue {
  private readonly heap: SimulationEvent[] = [];

  get size(): number {
    return this.heap.length;
  }

  push(event: SimulationEvent): void {
    this.heap.push(event);
    let index = this.heap.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (!precedes(this.heap[index]!, this.heap[parent]!)) break;
      [this.heap[index], this.heap[parent]] = [this.heap[parent]!, this.heap[index]!];
      index = parent;
    }
  }

  pop(): SimulationEvent | undefined {
    const first = this.heap[0];
    const last = this.heap.pop();
    if (!first || !last || this.heap.length === 0) return first;
    this.heap[0] = last;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;
      if (left < this.heap.length && precedes(this.heap[left]!, this.heap[smallest]!)) {
        smallest = left;
      }
      if (right < this.heap.length && precedes(this.heap[right]!, this.heap[smallest]!)) {
        smallest = right;
      }
      if (smallest === index) break;
      [this.heap[index], this.heap[smallest]] = [this.heap[smallest]!, this.heap[index]!];
      index = smallest;
    }
    return first;
  }
}
