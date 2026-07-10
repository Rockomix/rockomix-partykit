export class Deque<T> {
  private _capacity: number;
  private _length: number;
  private _front: number;
  private _data: (T | undefined)[];

  constructor(capacity: number | T[] = 16) {
    this._capacity = getCapacity(capacity);
    this._length = 0;
    this._front = 0;
    this._data = new Array<T | undefined>(this._capacity);

    if (Array.isArray(capacity)) {
      const len = capacity.length;
      for (let i = 0; i < len; ++i) {
        this._data[i] = capacity[i]!;
      }
      this._length = len;
    }
  }

  toArray() {
    const len = this._length;
    const ret = new Array<T | undefined>(len);
    const front = this._front;
    const capacity = this._capacity;
    for (let j = 0; j < len; ++j) {
      ret[j] = this._data[(front + j) & (capacity - 1)];
    }
    return ret;
  }

  push(...items: T[]) {
    const argsLength = items.length;
    let length = this._length;
    if (argsLength > 1) {
      const capacity = this._capacity;
      if (length + argsLength > capacity) {
        for (let i = 0; i < argsLength; ++i) {
          this._checkCapacity(length + 1);
          const j = (this._front + length) & (this._capacity - 1);
          this._data[j] = items[i];
          length++;
          this._length = length;
        }
        return length;
      } else {
        let j = this._front;
        for (let i = 0; i < argsLength; ++i) {
          this._data[(j + length) & (capacity - 1)] = items[i];
          j++;
        }
        this._length = length + argsLength;
        return length + argsLength;
      }
    }

    if (argsLength === 0) return length;

    this._checkCapacity(length + 1);
    const i = (this._front + length) & (this._capacity - 1);
    this._data[i] = items[0];
    this._length = length + 1;
    return length + 1;
  }

  pop() {
    const length = this._length;
    if (length === 0) {
      return undefined;
    }
    const i = (this._front + length - 1) & (this._capacity - 1);
    const ret = this._data[i];
    this._data[i] = undefined; // Mark as removed
    this._length = length - 1;
    return ret;
  }

  shift() {
    const length = this._length;
    if (length === 0) {
      return undefined;
    }
    const front = this._front;
    const ret = this._data[front];
    this._data[front] = undefined; // Mark as removed
    this._front = (front + 1) & (this._capacity - 1);
    this._length = length - 1;
    return ret;
  }

  unshift(...items: T[]) {
    let length = this._length;
    const argsLength = items.length;

    if (argsLength > 1) {
      const capacity = this._capacity;
      if (length + argsLength > capacity) {
        for (let i = argsLength - 1; i >= 0; i--) {
          this._checkCapacity(length + 1);
          const capacity = this._capacity;
          const j =
            (((this._front - 1) & (capacity - 1)) ^ capacity) - capacity;
          this._data[j] = items[i];
          length++;
          this._length = length;
          this._front = j;
        }
        return length;
      } else {
        let front = this._front;
        for (let i = argsLength - 1; i >= 0; i--) {
          const j = (((front - 1) & (capacity - 1)) ^ capacity) - capacity;
          this._data[j] = items[i];
          front = j;
        }
        this._front = front;
        this._length = length + argsLength;
        return length + argsLength;
      }
    }

    if (argsLength === 0) return length;

    this._checkCapacity(length + 1);
    const capacity = this._capacity;
    const i = (((this._front - 1) & (capacity - 1)) ^ capacity) - capacity;
    this._data[i] = items[0];
    this._length = length + 1;
    this._front = i;
    return length + 1;
  }

  peekBack() {
    const length = this._length;
    if (length === 0) {
      return undefined;
    }
    const index = (this._front + length - 1) & (this._capacity - 1);
    return this._data[index];
  }

  peekFront() {
    if (this._length === 0) {
      return undefined;
    }
    return this._data[this._front];
  }

  get(index: number) {
    let i = index;

    if (!Number.isInteger(i)) {
      return undefined;
    }
    const len = this._length;
    if (i < 0) {
      i += len;
    }
    if (i < 0 || i >= len) {
      return undefined;
    }
    return this._data[(this._front + i) & (this._capacity - 1)];
  }

  isEmpty() {
    return this._length === 0;
  }

  clear() {
    const len = this._length;
    const front = this._front;
    const capacity = this._capacity;
    for (let j = 0; j < len; ++j) {
      this._data[(front + j) & (capacity - 1)] = undefined;
    }
    this._length = 0;
    this._front = 0;
  }

  toString() {
    return this.toArray().toString();
  }

  valueOf() {
    return this.toString();
  }

  removeFront() {
    return this.shift();
  }

  removeBack() {
    return this.pop();
  }

  insertFront(...items: T[]) {
    return this.unshift(...items);
  }

  insertBack(...items: T[]) {
    return this.push(...items);
  }

  enqueue(...items: T[]) {
    return this.push(...items);
  }

  dequeue() {
    return this.shift();
  }

  toJSON() {
    return this.toArray();
  }

  get length() {
    return this._length;
  }

  set length(value: number) {
    throw new RangeError("Cannot set length of Deque directly.");
  }

  private _checkCapacity(size: number) {
    if (this._capacity < size) {
      this._resizeTo(getCapacity<T>(this._capacity * 1.5 + 16));
    }
  }

  private _resizeTo(capacity: number) {
    const oldCapacity = this._capacity;
    this._capacity = capacity;
    const front = this._front;
    const length = this._length;
    if (front + length > oldCapacity) {
      const moveItemsCount = (front + length) & (oldCapacity - 1);
      arrayMove(this._data, 0, this._data, oldCapacity, moveItemsCount);
    }
  }
}

function getCapacity<T>(capacity: number | T[]) {
  if (typeof capacity !== "number") {
    if (Array.isArray(capacity)) {
      capacity = capacity.length;
    } else {
      return 16; // Default capacity if input is invalid
    }
  }
  return pow2AtLeast(Math.min(Math.max(16, capacity), 1073741824));
}

function pow2AtLeast(n: number) {
  n = n >>> 0; // Ensure unsigned 32-bit integer
  n = n - 1;
  n = n | (n >> 1);
  n = n | (n >> 2);
  n = n | (n >> 4);
  n = n | (n >> 8);
  n = n | (n >> 16);
  return n + 1;
}

function arrayMove<T>(
  src: (T | undefined)[],
  srcIndex: number,
  dst: (T | undefined)[],
  dstIndex: number,
  len: number,
) {
  for (let j = 0; j < len; ++j) {
    dst[j + dstIndex] = src[j + srcIndex];
    src[j + srcIndex] = undefined; // Mark as moved
  }
}
