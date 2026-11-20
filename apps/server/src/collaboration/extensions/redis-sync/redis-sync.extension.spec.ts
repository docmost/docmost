import { EventEmitter } from 'node:events';
import { ConflictException, HttpException, Logger } from '@nestjs/common';
import { pack, unpack } from 'msgpackr';
import { RedisSyncExtension } from './redis-sync.extension';
import type { CustomEvents } from './redis-sync.types';

function makeRelay(serverId: string, customEvents: CustomEvents = {}) {
  const publisher = Object.assign(new EventEmitter(), {
    get: jest.fn().mockResolvedValue('owner'),
    publish: jest.fn().mockResolvedValue(1),
    disconnect: jest.fn(),
  });
  const subscriber = Object.assign(new EventEmitter(), {
    subscribe: jest.fn().mockResolvedValue(2),
    disconnect: jest.fn(),
  });
  const redis = {
    duplicate: jest.fn()
      .mockReturnValueOnce(publisher)
      .mockReturnValue(subscriber),
  };
  const relay = new RedisSyncExtension({
    redis: redis as any,
    pack,
    unpack,
    serverId,
    customEvents,
    customEventTTL: 50,
  });
  void relay.onConfigure({ instance: { documents: new Map() } } as any);

  async function receive(channel: string, message: Buffer) {
    const [listener] = subscriber.listeners('messageBuffer');
    await listener(Buffer.from(channel), message);
  }
  return { relay, publisher, subscriber, receive };
}

describe('Redis collaboration relay', () => {
  let logError: jest.SpyInstance;

  beforeEach(() => {
    logError = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });
  afterEach(() => jest.restoreAllMocks());

  it('subscribes to both channels again after a failed subscription and Redis reconnect', async () => {
    const { subscriber } = makeRelay('owner');
    const error = new Error('Redis connection closed');
    subscriber.subscribe.mockRejectedValueOnce(error);
    subscriber.emit('ready');
    await Promise.resolve();
    expect(logError).toHaveBeenCalledWith({ err: error }, expect.any(String));

    subscriber.emit('ready');
    expect(subscriber.subscribe.mock.calls).toEqual([
      ['collabMsg', 'collabMsg:owner'],
      ['collabMsg', 'collabMsg:owner'],
    ]);
  });

  it('returns owner errors and successful results to the requesting node', async () => {
    const conflict = new ConflictException('Page was archived');
    const owner = makeRelay('owner', {
      edit: async (_name, value) => {
        if (value === 'archived') throw conflict;
        if (value === 'removed') throw new Error('Page was removed');
        return value;
      },
    });
    const caller = makeRelay('caller');
    const dispatchErrors: unknown[] = [];
    // Redis acknowledges a publish independently of the subscriber processing it.
    caller.publisher.publish.mockImplementation(async (channel, message) => {
      owner.receive(channel, message).catch((err) => dispatchErrors.push(err));
      return 1;
    });
    owner.publisher.publish.mockImplementation(async (channel, message) => {
      caller.receive(channel, message).catch((err) => dispatchErrors.push(err));
      return 1;
    });

    const edit = (value: string | null) =>
      caller.relay.handleEvent('edit', 'page.1', value, true);
    const [archived, removed, success] = await Promise.allSettled([
      edit('archived'), edit('removed'), edit(null),
    ]);
    expect(archived).toMatchObject({
      status: 'rejected', reason: expect.any(HttpException),
    });
    if (archived.status === 'rejected') {
      expect(archived.reason.getStatus()).toBe(409);
      expect(archived.reason.getResponse()).toEqual(conflict.getResponse());
    }
    expect(removed).toMatchObject({
      status: 'rejected', reason: new Error('Page was removed'),
    });
    expect(success).toEqual({ status: 'fulfilled', value: null });
    expect(dispatchErrors).toEqual([]);
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({
        documentName: 'page.1', eventName: 'edit', err: new Error('Page was removed'),
      }),
      expect.any(String),
    );
    // Legacy callers treat every customEventComplete as success, including null.
    const replies = owner.publisher.publish.mock.calls.map(([, data]) => unpack(data));
    const legacySuccesses = replies.filter((reply) => reply.type === 'customEventComplete');
    expect(legacySuccesses).toHaveLength(1);
  });

  it('rejects promptly if publishing a request to its owner fails', async () => {
    const { relay, publisher } = makeRelay('caller');
    const error = new Error('Redis connection closed');
    publisher.publish.mockRejectedValue(error);

    await expect(relay.handleEvent('edit', 'page.1', {}, true)).rejects.toBe(error);
  });

  it('contains Redis dispatch failures and identifies the affected channel', async () => {
    const node = makeRelay('owner', { edit: async () => 'saved' });
    const channel = 'collabMsg:owner';
    const error = new Error('Reply could not be published');
    node.publisher.publish.mockRejectedValue(error);
    const request = {
      type: 'customEventStart',
      documentName: 'page.1',
      eventName: 'edit',
      payload: null,
      replyTo: 'collabMsg:caller',
      replyId: 1,
    };
    await expect(node.receive(channel, pack(request))).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ channel, err: error }), expect.any(String),
    );
  });

  it('identifies the Redis connection that emitted an error', () => {
    const { publisher, subscriber } = makeRelay('owner');
    const error = new Error('Redis unavailable');
    publisher.emit('error', error);
    subscriber.emit('error', error);
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ err: error }), expect.stringMatching(/publisher/i),
    );
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ err: error }), expect.stringMatching(/subscriber/i),
    );
  });
});
