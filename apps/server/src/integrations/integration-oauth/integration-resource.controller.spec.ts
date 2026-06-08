import { HttpException, NotFoundException } from '@nestjs/common';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { IntegrationResourceController } from './integration-resource.controller';
import { IntegrationOAuthRegistry } from './manifest.registry';
import {
  IntegrationNotConfiguredError,
  IntegrationNotConnectedError,
  IntegrationOAuthClientService,
  IntegrationReconnectRequiredError,
} from './integration-oauth-client.service';
import { IntegrationManifest } from './manifest.types';
import { IntegrationResourceManifest } from './resource.types';

const USER = { id: 'user-1' } as User;
const WORKSPACE = { id: 'ws-1' } as Workspace;
const INTEGRATION_ID = 'alpha:1111';

function buildController(resources: IntegrationResourceManifest[]) {
  const registry = new IntegrationOAuthRegistry();
  registry.register({
    id: 'alpha',
    name: 'Alpha',
    baseUrl: () => 'https://provider.example.com',
    authorizePath: '/oauth/authorize',
    tokenPath: '/oauth/token',
    scopes: ['read'],
    clientIdEnv: 'TEST_CLIENT_ID',
    clientSecretEnv: 'TEST_CLIENT_SECRET',
    resources,
  } as IntegrationManifest);
  const clientService = {
    get: jest.fn(),
    baseUrl: jest.fn(),
    settings: jest.fn(),
  } as unknown as IntegrationOAuthClientService;
  return new IntegrationResourceController(registry, clientService);
}

function itemResource(
  overrides: Partial<IntegrationResourceManifest> = {},
): IntegrationResourceManifest {
  return {
    id: 'item',
    title: 'Item',
    renderKind: 'item-card',
    resolve: async (_ctx, args) => ({
      kind: 'item-card',
      key: args.resourceKey,
      title: 'Resolved',
    }),
    ...overrides,
  };
}

async function httpError(promise: Promise<unknown>): Promise<HttpException> {
  try {
    await promise;
  } catch (err) {
    return err as HttpException;
  }
  throw new Error('expected the call to reject');
}

describe('IntegrationResourceController', () => {
  describe('lookup', () => {
    it('404s on unknown integrations', async () => {
      const controller = buildController([itemResource()]);
      await expect(
        controller.resolve(USER, WORKSPACE, 'nope:1', 'item', 'WI-1', undefined),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('404s on unknown resources', async () => {
      const controller = buildController([itemResource()]);
      await expect(
        controller.resolve(USER, WORKSPACE, INTEGRATION_ID, 'nope', 'WI-1', undefined),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('search', () => {
    it('returns empty items when the resource declares no search', async () => {
      const controller = buildController([itemResource()]);
      await expect(
        controller.search(USER, WORKSPACE, INTEGRATION_ID, 'item', 'q', undefined),
      ).resolves.toEqual({ items: [] });
    });

    it('passes only the typed q/limit args to the provider search', async () => {
      const search = jest.fn().mockResolvedValue([{ key: 'k', title: 't' }]);
      const controller = buildController([itemResource({ search })]);
      const result = await controller.search(
        USER,
        WORKSPACE,
        INTEGRATION_ID,
        'item',
        'hello',
        '5',
      );
      expect(result).toEqual({ items: [{ key: 'k', title: 't' }] });
      expect(search).toHaveBeenCalledTimes(1);
      const [ctx, args] = search.mock.calls[0];
      expect(args).toEqual({ q: 'hello', limit: 5 });
      expect(ctx).toMatchObject({
        integrationId: INTEGRATION_ID,
        workspaceId: WORKSPACE.id,
        userId: USER.id,
      });
      expect(typeof ctx.client.get).toBe('function');
    });

    it('drops a non-numeric limit instead of forwarding it', async () => {
      const search = jest.fn().mockResolvedValue([]);
      const controller = buildController([itemResource({ search })]);
      await controller.search(USER, WORKSPACE, INTEGRATION_ID, 'item', 'q', 'abc');
      expect(search.mock.calls[0][1]).toEqual({ q: 'q', limit: undefined });
    });
  });

  describe('resolve', () => {
    it('requires a resource key', async () => {
      const controller = buildController([itemResource()]);
      const err = await httpError(
        controller.resolve(USER, WORKSPACE, INTEGRATION_ID, 'item', undefined, undefined),
      );
      expect(err.getStatus()).toBe(400);
      expect(err.getResponse()).toMatchObject({
        code: 'INTEGRATION_RESOURCE_BAD_REQUEST',
      });
    });

    it('resolves with parsed params', async () => {
      const resolve = jest.fn().mockResolvedValue({
        kind: 'table-report',
        title: 'Report',
        rows: [],
      });
      const controller = buildController([itemResource({ resolve })]);
      await controller.resolve(
        USER,
        WORKSPACE,
        INTEGRATION_ID,
        'item',
        'report-1',
        JSON.stringify({ page: 2 }),
      );
      expect(resolve.mock.calls[0][1]).toEqual({
        resourceKey: 'report-1',
        params: { page: 2 },
      });
    });

    it('rejects malformed and non-object params JSON', async () => {
      const controller = buildController([itemResource()]);
      for (const bad of ['{not json', '[1,2]', '"str"']) {
        const err = await httpError(
          controller.resolve(USER, WORKSPACE, INTEGRATION_ID, 'item', 'k', bad),
        );
        expect(err.getStatus()).toBe(400);
      }
    });
  });

  describe('error mapping', () => {
    async function resolveWith(thrown: Error) {
      const controller = buildController([
        itemResource({ resolve: async () => Promise.reject(thrown) }),
      ]);
      return httpError(
        controller.resolve(USER, WORKSPACE, INTEGRATION_ID, 'item', 'WI-1', undefined),
      );
    }

    it.each([
      [new IntegrationNotConfiguredError('alpha'), 'INTEGRATION_NOT_CONFIGURED'],
      [new IntegrationNotConnectedError('alpha'), 'INTEGRATION_NOT_CONNECTED'],
      [
        new IntegrationReconnectRequiredError('alpha'),
        'INTEGRATION_RECONNECT_REQUIRED',
      ],
    ])('maps %p to a 409 with a stable code', async (thrown, code) => {
      const err = await resolveWith(thrown);
      expect(err.getStatus()).toBe(409);
      expect(err.getResponse()).toMatchObject({ code });
    });

    it('maps provider HTTP errors to their status', async () => {
      const providerErr = new Error('not found') as Error & { status?: number };
      providerErr.status = 404;
      const err = await resolveWith(providerErr);
      expect(err.getStatus()).toBe(404);
      expect(err.getResponse()).toMatchObject({
        code: 'INTEGRATION_PROVIDER_HTTP_ERROR',
      });
    });

    it('maps unexpected provider failures to an opaque 502', async () => {
      const err = await resolveWith(new Error('secret token abc123 leaked'));
      expect(err.getStatus()).toBe(502);
      const body = err.getResponse() as { code: string; message: string };
      expect(body.code).toBe('INTEGRATION_RESOURCE_ERROR');
      expect(body.message).not.toContain('abc123');
    });
  });
});
