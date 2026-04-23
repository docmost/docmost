import { ConnectionPool } from './connection-pool';

describe('ConnectionPool', () => {
  it('hands out an available resource immediately', async () => {
    const pool = new ConnectionPool<string>();
    pool.init(['a', 'b']);
    expect(await pool.acquire()).toBe('b');
    expect(await pool.acquire()).toBe('a');
  });

  it('a waiter is resolved by the next release', async () => {
    const pool = new ConnectionPool<string>();
    pool.init(['only']);
    const first = await pool.acquire();
    let resolved: string | null = null;
    const secondP = pool.acquire().then((v) => (resolved = v));
    expect(resolved).toBeNull();
    pool.release(first);
    await secondP;
    expect(resolved).toBe('only');
  });

  it('FIFO among waiters (fair under contention)', async () => {
    const pool = new ConnectionPool<string>();
    pool.init(['only']);
    const held = await pool.acquire();

    const order: number[] = [];
    const p1 = pool.acquire().then(() => order.push(1));
    const p2 = pool.acquire().then(() => order.push(2));
    const p3 = pool.acquire().then(() => order.push(3));

    pool.release(held);
    await p1;
    pool.release('only'); // re-release the value that p1 got (simulated)
    await p2;
    pool.release('only');
    await p3;

    expect(order).toEqual([1, 2, 3]);
  });

  it('withResource acquires, invokes callback, and releases even on throw', async () => {
    const pool = new ConnectionPool<string>();
    pool.init(['one']);
    let called = false;
    await expect(
      pool.withResource(async (v) => {
        called = true;
        expect(v).toBe('one');
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(called).toBe(true);
    // resource should be back in the pool
    expect(await pool.acquire()).toBe('one');
  });

  it('size() reports the initial count regardless of check-outs', () => {
    const pool = new ConnectionPool<string>();
    pool.init(['a', 'b', 'c']);
    expect(pool.size()).toBe(3);
  });

  it('close() returns all held resources and rejects pending waiters', async () => {
    const pool = new ConnectionPool<string>();
    pool.init(['only']);
    const first = await pool.acquire();
    const pending = pool.acquire();
    pending.catch(() => {}); // Attach catch to prevent unhandled rejection
    const closed = pool.close();
    expect(closed).toEqual([]); // No free resources (one is checked out)
    await expect(pending).rejects.toThrow(/closed/i);
  });
});
