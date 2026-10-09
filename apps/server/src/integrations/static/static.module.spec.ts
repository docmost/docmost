import { HttpAdapterHost } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { StaticModule } from './static.module';
import { EnvironmentService } from '../environment/environment.service';

jest.mock('node:fs', () => {
  const actual = jest.requireActual<typeof import('node:fs')>('node:fs');
  const { Readable } = jest.requireActual<typeof import('node:stream')>(
    'node:stream',
  );
  const isClientDist = (path: unknown) => String(path).includes('client/dist');

  return {
    ...actual,
    existsSync: (path: string) => isClientDist(path) || actual.existsSync(path),
    readFileSync: (path: string, ...rest: any[]) =>
      isClientDist(path)
        ? '<html><head><!--window-config--></head></html>'
        : (actual.readFileSync as any)(path, ...rest),
    writeFileSync: (path: string, ...rest: any[]) =>
      isClientDist(path)
        ? undefined
        : (actual.writeFileSync as any)(path, ...rest),
    copyFileSync: (path: string, ...rest: any[]) =>
      isClientDist(path)
        ? undefined
        : (actual.copyFileSync as any)(path, ...rest),
    createReadStream: (path: string, ...rest: any[]) =>
      isClientDist(path)
        ? Readable.from(['<html></html>'])
        : (actual.createReadStream as any)(path, ...rest),
  };
});

describe('StaticModule', () => {
  let adapter: FastifyAdapter;

  beforeEach(async () => {
    adapter = new FastifyAdapter();
    const environmentService = new Proxy(
      {},
      { get: () => () => undefined },
    ) as unknown as EnvironmentService;

    await new StaticModule(
      { httpAdapter: adapter } as unknown as HttpAdapterHost,
      environmentService,
    ).onModuleInit();
  });

  afterEach(async () => {
    await adapter.close();
  });

  it('returns 404 for an asset the current build does not have', async () => {
    const response = await adapter
      .getInstance()
      .inject({ method: 'GET', url: '/assets/groups-stale.js' });

    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type'] ?? '').not.toContain('text/html');
    expect(response.headers['cache-control']).toContain('no-store');
  });

  it('serves the app shell for client routes', async () => {
    const response = await adapter
      .getInstance()
      .inject({ method: 'GET', url: '/settings/groups' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
  });
});
