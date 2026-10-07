import { Logger, NotFoundException } from '@nestjs/common';
import { Job } from 'bullmq';
import { IntegrationProcessor } from './integration.processor';
import { TokenInvalidError } from './registry/integration-provider.interface';
import { QueueJob } from '../../integrations/queue/constants/queue.constants';

describe('IntegrationProcessor token refresh', () => {
  const connections = [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }];
  const manyConnections = (count: number) =>
    Array.from({ length: count }, (_, i) => ({ id: `c${i + 1}` }));
  const flushPromises = () => new Promise((resolve) => setImmediate(resolve));
  const refreshJob = { name: QueueJob.INTEGRATION_TOKEN_REFRESH } as Job;

  function build(refreshAccessToken: jest.Mock, rows: object[] = connections) {
    const connectionRepo = {
      findExpiringTokens: jest.fn().mockResolvedValue(rows),
      invalidate: jest.fn().mockResolvedValue(undefined),
    };
    const oauthService = { refreshAccessToken };
    const processor = new IntegrationProcessor(
      connectionRepo as any,
      oauthService as any,
    );
    return { processor, connectionRepo, oauthService };
  }

  it('loads at most 500 connections expiring within 15 minutes', async () => {
    const { processor, connectionRepo } = build(jest.fn());

    await processor.process(refreshJob);

    expect(connectionRepo.findExpiringTokens).toHaveBeenCalledWith(
      15 * 60 * 1000,
      500,
    );
  });

  it('refreshes every selected connection exactly once', async () => {
    const rows = manyConnections(12);
    const refreshAccessToken = jest.fn().mockResolvedValue(undefined);
    const { processor } = build(refreshAccessToken, rows);

    await processor.process(refreshJob);

    expect(refreshAccessToken.mock.calls.map(([row]) => row.id).sort()).toEqual(
      rows.map((row) => row.id).sort(),
    );
  });

  it('refreshes five connections at a time', async () => {
    let running = 0;
    let mostRunning = 0;
    const refreshAccessToken = jest.fn(async () => {
      running += 1;
      mostRunning = Math.max(mostRunning, running);
      await flushPromises();
      running -= 1;
    });
    const { processor } = build(refreshAccessToken, manyConnections(12));

    await processor.process(refreshJob);

    expect(refreshAccessToken).toHaveBeenCalledTimes(12);
    expect(mostRunning).toBe(5);
  });

  it('keeps refreshing the rest while one refresh hangs', async () => {
    const refreshAccessToken = jest
      .fn()
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValue(undefined);
    const { processor } = build(refreshAccessToken, manyConnections(8));
    const controller = new AbortController();

    const run = processor.process(refreshJob, undefined, controller.signal);
    await flushPromises();

    expect(refreshAccessToken).toHaveBeenCalledTimes(8);
    controller.abort('lock lost');
    await expect(run).rejects.toThrow('lock lost');
  });

  it('never retires a connection itself and keeps refreshing the rest', async () => {
    const refreshAccessToken = jest
      .fn()
      .mockRejectedValueOnce(new TokenInvalidError())
      .mockRejectedValueOnce(new NotFoundException())
      .mockRejectedValueOnce(new Error('network'));
    const { processor, connectionRepo } = build(refreshAccessToken);

    await processor.process({
      name: QueueJob.INTEGRATION_TOKEN_REFRESH,
    } as Job);

    expect(refreshAccessToken).toHaveBeenCalledTimes(3);
    expect(connectionRepo.invalidate).not.toHaveBeenCalled();
  });

  describe('cancellation', () => {
    const job = { id: 'j1', name: QueueJob.INTEGRATION_TOKEN_REFRESH } as Job;
    const hang = () => new Promise<string>(() => {});

    afterEach(() => jest.restoreAllMocks());

    it('starts no further refreshes once the job is aborted', async () => {
      const finishers: Array<(token: string) => void> = [];
      const refreshAccessToken = jest.fn(
        () => new Promise<string>((resolve) => finishers.push(resolve)),
      );
      const { processor } = build(refreshAccessToken, manyConnections(7));
      const controller = new AbortController();

      const run = processor.process(job, undefined, controller.signal);
      await flushPromises();
      expect(refreshAccessToken).toHaveBeenCalledTimes(5);
      controller.abort('lock lost');

      await expect(run).rejects.toThrow('lock lost');
      finishers.forEach((finish) => finish('token'));
      await flushPromises();
      expect(refreshAccessToken).toHaveBeenCalledTimes(5);
    });

    it('fails a hung run when the job timeout fires', async () => {
      const timeout = new AbortController();
      jest.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal);
      const { processor } = build(jest.fn(hang));

      const run = processor.process(
        job,
        undefined,
        new AbortController().signal,
      );
      await flushPromises();
      timeout.abort(new DOMException('timed out', 'TimeoutError'));

      await expect(run).rejects.toThrow('timed out');
    }, 1000);

    it('logs the connections in flight when aborted', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      const { processor } = build(jest.fn(hang));
      const controller = new AbortController();

      const run = processor.process(job, undefined, controller.signal);
      await flushPromises();
      controller.abort('lock lost');

      await expect(run).rejects.toThrow();
      expect(warn.mock.calls).toEqual([
        [
          'Token refresh aborted while refreshing connections c1, c2, c3: lock lost',
        ],
      ]);
    });

    it('logs the load step when aborted before any refresh starts', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      const { processor, connectionRepo } = build(jest.fn());
      connectionRepo.findExpiringTokens.mockImplementation(hang);
      const controller = new AbortController();

      const run = processor.process(job, undefined, controller.signal);
      await flushPromises();
      controller.abort('lock lost');

      await expect(run).rejects.toThrow();
      expect(warn.mock.calls).toEqual([
        ['Token refresh aborted while loading expiring tokens: lock lost'],
      ]);
    });

    it('does not log an abort after the run completes', async () => {
      const timeout = new AbortController();
      jest.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal);
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      const { processor } = build(jest.fn().mockResolvedValue('token'));

      await processor.process(job, undefined, new AbortController().signal);
      timeout.abort(new DOMException('timed out', 'TimeoutError'));

      expect(warn).not.toHaveBeenCalled();
    });

    it('cancels every job whose lock renewal failed', () => {
      const { processor } = build(jest.fn());
      const cancelJob = jest.fn();
      Object.assign(processor, { _worker: { cancelJob } });

      processor.onLockRenewalFailed(['j1', 'j2']);

      expect(cancelJob).toHaveBeenCalledWith('j1', 'lock lost');
      expect(cancelJob).toHaveBeenCalledWith('j2', 'lock lost');
    });
  });
});
