import { IncomingMessage } from 'node:http';
import { EventEmitter } from 'node:events';
import { Logger } from '@nestjs/common';
import { WebSocket } from 'ws';
import { CollaborationGateway } from './collaboration.gateway';
import { CollaborationHandler } from './collaboration.handler';
import { editableDocument, pageRevision } from './block-edit/block-refs';
import { tiptapExtensions } from './collaboration.util';
import { TiptapTransformer } from '@hocuspocus/transformer';
import * as Y from 'yjs';

function makeGateway() {
  const environmentService = {
    getRedisUrl: () => 'redis://localhost:6379',
    isCollabDisableRedis: () => true,
  };
  const gateway = new CollaborationGateway(
    {} as any,
    {} as any,
    {} as any,
    environmentService as any,
    new CollaborationHandler(),
  );
  const redisSync = {
    onSocketOpen: jest.fn(),
    onSocketMessage: jest.fn(),
    onSocketClose: jest.fn(),
    handleEvent: jest.fn(),
  };
  (gateway as any).redisSync = redisSync;
  return { gateway, redisSync };
}

function makeSocket() {
  return Object.assign(new EventEmitter(), {
    readyState: WebSocket.OPEN,
    close: jest.fn(),
    send: jest.fn(),
  });
}

describe('CollaborationGateway.handleConnection', () => {
  const request = {
    headers: { 'sec-websocket-key': 'key' },
    socket: {},
  } as IncomingMessage;
  afterEach(() => jest.restoreAllMocks());

  it('passes the resolved client ip with the connection', () => {
    const { gateway, redisSync } = makeGateway();
    const request = {
      method: 'GET',
      url: '/collab',
      headers: {
        'sec-websocket-key': 'key',
        'x-forwarded-for': '162.158.1.1',
        'cf-connecting-ip': '198.51.100.20',
      },
      socket: { remoteAddress: '10.42.0.66' },
    } as unknown as IncomingMessage;

    gateway.handleConnection({ on: jest.fn() } as unknown as WebSocket, request);

    expect(redisSync.onSocketOpen).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ socket: { remoteAddress: '198.51.100.20' } }),
    );
  });

  it.each(['open', 'message'] as const)(
    'closes the affected socket on a relay %s error',
    async (phase) => {
      const { gateway, redisSync } = makeGateway();
      const failure = new Error('Redis unavailable');
      const logger = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      if (phase === 'open') {
        redisSync.onSocketOpen.mockImplementation(() => { throw failure; });
      } else {
        redisSync.onSocketMessage.mockRejectedValue(failure);
      }
      const socket = makeSocket();
      gateway.handleConnection(socket as unknown as WebSocket, request);
      if (phase === 'message') {
        socket.emit('message', Buffer.alloc(0), true);
        await new Promise<void>((resolve) => setImmediate(resolve));
      }
      expect(socket.close).toHaveBeenCalledWith(1011);
      expect(logger).toHaveBeenCalledWith(
        expect.objectContaining({ err: failure }), expect.any(String),
      );
    },
  );

  it('handles a failed outbound WebSocket write on the originating socket', () => {
    const { gateway, redisSync } = makeGateway();
    const failure = new Error('Socket write failed');
    const logger = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const socket = makeSocket();
    socket.send.mockImplementation((_message, done) => done(failure));
    gateway.handleConnection(socket as unknown as WebSocket, request);
    const [wrappedSocket] = redisSync.onSocketOpen.mock.calls[0];
    wrappedSocket.send(Uint8Array.of(1));
    expect(socket.close).toHaveBeenCalledWith(1011);
    expect(logger).toHaveBeenCalledWith(
      expect.objectContaining({ err: failure }), expect.any(String),
    );
  });
});

describe('CollaborationGateway page events', () => {
  const name = 'page.one';
  const json = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'body' }] }],
  };

  it('routes reads and writes through Redis when enabled', async () => {
    const { gateway, redisSync } = makeGateway();
    redisSync.handleEvent.mockResolvedValue(json);
    expect(
      await gateway.handleYjsEvent('getPageContent', name, undefined, true),
    ).toBe(json);
    expect(redisSync.handleEvent).toHaveBeenCalledWith(
      'getPageContent',
      name,
      undefined,
      true,
    );
    const payload = { edits: [], user: {} as any, expectedRevision: 'v1-read' };
    await gateway.handleYjsEvent('applyBlockEdits', name, payload);
    expect(redisSync.handleEvent).toHaveBeenCalledWith(
      'applyBlockEdits',
      name,
      payload,
      false,
    );
  });

  it('reads loaded rooms and applies guarded writes to closed rooms with Redis disabled', async () => {
    const { gateway } = makeGateway();
    (gateway as any).redisSync = null;
    const hp = (gateway as any).hocuspocus;
    const ydoc = TiptapTransformer.toYdoc(json, 'default', tiptapExtensions);
    const open = jest.spyOn(hp, 'openDirectConnection').mockResolvedValue({
      transact: async (fn: (doc: Y.Doc) => void) =>
        ydoc.transact(() => fn(ydoc)),
      disconnect: async () => undefined,
    });
    expect(
      await gateway.handleYjsEvent('getPageContent', name, undefined, true),
    ).toBeUndefined();
    expect(open).not.toHaveBeenCalled();
    const changed = await gateway.handleYjsEvent('applyBlockEdits', name, {
      expectedRevision: pageRevision(editableDocument(json)),
      user: {} as any,
      edits: [
        { type: 'replace_text', ref: 'b1', oldText: 'body', newText: 'edited' },
      ],
    });
    expect(changed).toMatchObject({ ok: true });
    hp.documents.set(name, ydoc);
    const live = await gateway.handleYjsEvent(
      'getPageContent',
      name,
      undefined,
      true,
    );
    expect(editableDocument(live).textContent).toBe('edited');
    expect(open).toHaveBeenCalledTimes(1);
  });
});
