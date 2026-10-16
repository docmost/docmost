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
