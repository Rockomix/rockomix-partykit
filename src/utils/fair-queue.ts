import { Deque } from "./double-ended-queue";

interface FlowData<T> {
  data: T;
  size: number;
}

class Flow<T> {
  queue: Deque<FlowData<T>>;
  deficit: number;

  constructor() {
    this.queue = new Deque<FlowData<T>>();
    this.deficit = 0;
  }
}

interface FairQueueOptions {
  quantumSize?: number;
  // onUnidle?: () => void;
}

export class FairQueue<T> {
  length: number;
  activeList: Deque<Flow<T>>;
  activeFlow: Flow<T> | undefined;
  flows: Record<string, Flow<T>>;
  quantumSize: number;
  // onUnidle: () => void;

  constructor(options?: FairQueueOptions) {
    this.length = 0;
    this.activeList = new Deque<Flow<T>>();
    this.activeFlow = undefined;
    this.flows = {};
    this.quantumSize = options?.quantumSize ?? 1;
    // this.onUnidle = options?.onUnidle ?? (() => {});
  }

  push(flowId: string, data: T, size: number) {
    const flow = lookupFlow<T>(this, flowId);

    if (typeof size !== "number" || !Number.isFinite(size)) {
      throw new Error("The size must be a finite number");
    }

    const count = flow.queue.push({ data, size });

    if (count === 1 && this.activeFlow !== flow) {
      this.activeList.push(flow);
    }

    this.length++;
    // if (this.length === 1) {
    //   this.onUnidle();
    // }
  }

  private _processActiveFlow() {
    const activeFlow = this.activeFlow;
    if (!activeFlow) return null; // Safety check

    const queue = activeFlow.queue;
    if (!queue.isEmpty()) {
      const next = queue.peekFront();
      if (next && next.size <= activeFlow.deficit) {
        // null check for next
        activeFlow.deficit -= next.size;
        queue.shift();
        this.length--;
        return next.data;
      } else {
        this.activeList.push(activeFlow);
      }
    }
    this.activeFlow = undefined;
    return null;
  }

  pop() {
    let result: T | null = null;

    if (this.activeFlow) {
      result = this._processActiveFlow();
      if (result) {
        return result;
      }
    }

    while (!this.activeList.isEmpty()) {
      this.activeFlow = this.activeList.shift();
      if (this.activeFlow) {
        // null check for activeFlow
        this.activeFlow.deficit += this.quantumSize;
        result = this._processActiveFlow();
        if (result) {
          return result;
        }
      }
    }

    return undefined; // No work in the queue
  }

  toArray() {
    const resultArray = Array<T | undefined>();

    while (this.length > 0) {
      resultArray.push(this.pop());
    }

    for (const item of resultArray) {
      this.push("John", item!, 1);
    }

    return resultArray;
  }
}

function lookupFlow<T>(drrQueue: FairQueue<T>, flowId: string) {
  let flow = drrQueue.flows[flowId];
  if (!flow) {
    flow = new Flow<T>();
    drrQueue.flows[flowId] = flow;
  }
  return flow;
}
