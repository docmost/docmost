import { UnauthorizedException } from '@nestjs/common';
import { WsGateway } from './ws.gateway';

const TOKEN = { sub: 'user_1', workspaceId: 'workspace_1', type: 'access' };
const PAGE_ID = 'page_1';

const flush = () => new Promise((resolve) => setImmediate(resolve));

function makeGateway(
  authorize: () => Promise<string[]> = async () => ['space_1'],
  verify: () => Promise<unknown> = async () => TOKEN,
) {
  const tokenService = { verifyJwt: jest.fn(verify) };
  const wsService = {
    authorizeConnection: jest.fn(authorize),
    isTreeEvent: jest.fn((data: any) => data?.operation === 'addTreeNode'),
    handleTreeEvent: jest.fn(async () => undefined),
  };
  const seen: Array<{ userId?: string; workspaceId?: string }> = [];
  const baseRealtime = {
    isBaseEvent: jest.fn((data: any) =>
      String(data?.operation).startsWith('base:'),
    ),
    handleInbound: jest.fn(async (client: any) => {
      seen.push({
        userId: client.data.userId,
        workspaceId: client.data.workspaceId,
      });
    }),
  };
  const gateway = new WsGateway(
    tokenService as any,
    wsService as any,
    baseRealtime as any,
  );
  const client = {
    handshake: { headers: { cookie: 'authToken=token' } },
    data: {} as Record<string, any>,
    join: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    conn: { close: jest.fn() },
  };
  return { gateway, client, wsService, baseRealtime, seen };
}

describe('WsGateway.handleMessage', () => {
  it('handles a message that arrives during authorization after it has finished', async () => {
    let finish: (ids: string[]) => void = () => undefined;
    const { gateway, client, baseRealtime, seen } = makeGateway(
      () => new Promise<string[]>((resolve) => (finish = resolve)),
    );

    const connecting = gateway.handleConnection(client as any);
    const handling = gateway.handleMessage(client as any, {
      operation: 'base:subscribe',
      pageId: PAGE_ID,
    });
    await flush();
    expect(baseRealtime.handleInbound).not.toHaveBeenCalled();

    finish(['space_1']);
    await Promise.all([connecting, handling]);

    expect(baseRealtime.handleInbound).toHaveBeenCalledTimes(1);
    expect(seen).toEqual([{ userId: 'user_1', workspaceId: 'workspace_1' }]);
  });

  it('still hands on a message when the connection is refused', async () => {
    const { gateway, client, baseRealtime, seen } = makeGateway(
      async () => ['space_1'],
      async () => {
        throw new UnauthorizedException();
      },
    );

    await gateway.handleConnection(client as any);
    await gateway.handleMessage(client as any, {
      operation: 'base:subscribe',
      pageId: PAGE_ID,
    });

    expect(client.disconnect).toHaveBeenCalledTimes(1);
    expect(baseRealtime.handleInbound).toHaveBeenCalledTimes(1);
    expect(seen).toEqual([{ userId: undefined, workspaceId: undefined }]);
  });

  it('handles later messages without delay', async () => {
    const { gateway, client, wsService, baseRealtime, seen } = makeGateway();

    await gateway.handleConnection(client as any);
    await gateway.handleMessage(client as any, {
      operation: 'base:subscribe',
      pageId: PAGE_ID,
    });
    const tree = { operation: 'addTreeNode', spaceId: 'space_1' };
    await gateway.handleMessage(client as any, tree);

    expect(baseRealtime.handleInbound).toHaveBeenCalledTimes(1);
    expect(seen).toEqual([{ userId: 'user_1', workspaceId: 'workspace_1' }]);
    expect(wsService.handleTreeEvent).toHaveBeenCalledWith(client, tree);
    expect(client.join).toHaveBeenCalledWith([
      'user-user_1',
      'workspace-workspace_1',
      'space-space_1',
    ]);
  });
});
