type Waiter<T> = {
  resolve: (value: T) => void;
  reject: (err: Error) => void;
};

/*
 * A minimal async resource pool. No external deps. Semantics:
 *
 *   - `acquire()` returns an available resource immediately, or a Promise
 *     that resolves when one is released.
 *   - `release(r)` returns a resource. If there are pending waiters, hands
 *     to the FIFO-first one. Otherwise returns to the free list.
 *   - `withResource(fn)` acquires, invokes, and releases — releases even
 *     if `fn` throws.
 *   - `close()` rejects all pending waiters and returns the currently-free
 *     resources so the owner can release them. Already-checked-out
 *     resources are the caller's responsibility to finish with and re-release
 *     (they'll get a no-op release, the pool being closed).
 *
 * Initial size is set via `init(resources)`. Resources must not be checked
 * out before `init` is called. `size()` reports the canonical count (does
 * not decrement on acquire).
 */
export class ConnectionPool<T> {
  private free: T[] = [];
  private waiters: Waiter<T>[] = [];
  private initialCount = 0;
  private closed = false;

  init(resources: T[]): void {
    if (this.initialCount !== 0) {
      throw new Error('ConnectionPool already initialised');
    }
    this.free = [...resources];
    this.initialCount = resources.length;
  }

  size(): number {
    return this.initialCount;
  }

  async acquire(): Promise<T> {
    if (this.closed) {
      throw new Error('ConnectionPool is closed');
    }
    if (this.free.length > 0) {
      return this.free.pop()!;
    }
    return new Promise<T>((resolve, reject) => {
      this.waiters.push({ resolve, reject });
    });
  }

  release(resource: T): void {
    if (this.closed) {
      // Drop; caller expected this
      return;
    }
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter.resolve(resource);
    } else {
      this.free.push(resource);
    }
  }

  async withResource<R>(fn: (resource: T) => Promise<R>): Promise<R> {
    const resource = await this.acquire();
    try {
      return await fn(resource);
    } finally {
      this.release(resource);
    }
  }

  close(): T[] {
    this.closed = true;
    for (const waiter of this.waiters) {
      waiter.reject(new Error('ConnectionPool is closed'));
    }
    this.waiters = [];
    const remaining = this.free;
    this.free = [];
    return remaining;
  }
}
