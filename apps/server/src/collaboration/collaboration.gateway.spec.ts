import { IncomingMessage } from 'node:http';
import WebSocket from 'ws';
import { CollaborationGateway } from './collaboration.gateway';

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
    {} as any,
  );
  const redisSync = {
    onSocketOpen: jest.fn(),
    onSocketMessage: jest.fn(),
    onSocketClose: jest.fn(),
  };
  (gateway as any).redisSync = redisSync;
  return { gateway, redisSync };
}

function makeLocalGateway(handlers: Record<string, jest.Mock>) {
  const environmentService = {
    getRedisUrl: () => 'redis://localhost:6379',
    isCollabDisableRedis: () => true,
  };
  const collaborationHandler = { getHandlers: jest.fn(() => handlers) };
  const gateway = new CollaborationGateway(
    {} as any,
    {} as any,
    {} as any,
    environmentService as any,
    collaborationHandler as any,
  );
  return { gateway, collaborationHandler };
}

describe('CollaborationGateway.handleYjsEvent', () => {
  it('handleYjsEvent uses local handlers when redisSync is null', async () => {
    const updatePageContent = jest.fn(async () => undefined);
    const freezeDraft = jest.fn(async () => ({ type: 'doc' }));
    const { gateway, collaborationHandler } = makeLocalGateway({
      updatePageContent,
      freezeDraft,
    });
    const payload = {
      operation: 'append',
      prosemirrorJson: { type: 'doc', content: [] },
      user: { id: 'user_1' },
    } as any;

    expect((gateway as any).redisSync).toBeNull();
    await gateway.handleYjsEvent('updatePageContent', 'page.a', payload);
    const frozen = await gateway.handleYjsEvent(
      'freezeDraft',
      'page.a',
      undefined,
    );

    expect(updatePageContent).toHaveBeenCalledWith('page.a', payload);
    expect(frozen).toEqual({ type: 'doc' });
    expect(collaborationHandler.getHandlers).toHaveBeenCalledWith(
      (gateway as any).hocuspocus,
    );
  });

  it('skips documents that are not open when onlyIfOpen is set', async () => {
    const resetConnections = jest.fn(async () => undefined);
    const { gateway } = makeLocalGateway({ resetConnections });

    const result = await gateway.handleYjsEvent(
      'resetConnections',
      'page.a',
      undefined,
      true,
    );

    expect(result).toBeUndefined();
    expect(resetConnections).not.toHaveBeenCalled();

    (gateway as any).hocuspocus.documents.set('page.a', {});
    await gateway.handleYjsEvent('resetConnections', 'page.a', undefined, true);
    expect(resetConnections).toHaveBeenCalledWith('page.a', undefined);
  });
});

describe('CollaborationGateway.handleConnection', () => {
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
});
