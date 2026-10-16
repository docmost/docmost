import { IntegrationConnectionService } from './integration-connection.service';

const connectedAt = new Date('2026-10-07T09:00:00.000Z');

function buildService(rows: Record<string, unknown>[]) {
  const connectionRepo = {
    findByUserAndWorkspace: jest.fn().mockResolvedValue(rows),
  };
  return new IntegrationConnectionService(
    connectionRepo as any,
    {} as any,
    { log: jest.fn() } as any,
  );
}

describe('IntegrationConnectionService connections list', () => {
  it("shows the Slack link's account name and id", async () => {
    const service = buildService([
      {
        integrationId: 'integration-slack',
        type: 'slack',
        providerUserId: 'U04ABCD1234',
        metadata: {
          account: { id: 'U04ABCD1234', displayName: 'Philip' },
          notifyEnabled: true,
        },
        createdAt: connectedAt,
        invalidatedAt: null,
      },
    ]);

    await expect(
      service.getUserConnections('user-1', 'workspace-1'),
    ).resolves.toEqual([
      {
        integrationId: 'integration-slack',
        type: 'slack',
        providerUserId: 'U04ABCD1234',
        providerDisplayName: 'Philip',
        connectedAt,
        invalidatedAt: null,
      },
    ]);
  });

  it('keeps the account of every other provider out of the list', async () => {
    const service = buildService([
      {
        integrationId: 'integration-github',
        type: 'github',
        providerUserId: '583231',
        metadata: {
          account: { id: '583231', displayName: 'Philip', username: 'Philipinho' },
        },
        createdAt: connectedAt,
        invalidatedAt: null,
      },
    ]);

    await expect(
      service.getUserConnections('user-1', 'workspace-1'),
    ).resolves.toEqual([
      {
        integrationId: 'integration-github',
        type: 'github',
        providerUserId: null,
        providerDisplayName: null,
        connectedAt,
        invalidatedAt: null,
      },
    ]);
  });
});
