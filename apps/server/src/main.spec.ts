import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

it('exits nonzero when bootstrap fails even with background connections alive', () => {
  // Execute the real entrypoint in a child: mocking process.exit in Jest would
  // miss the original failure, a process kept alive by Redis/worker handles.
  const child = spawnSync(process.execPath, ['-e', `
    const fs = require('node:fs');
    const ts = require(process.argv[2]);
    const entry = process.argv[1];
    const compiled = ts.transpileModule(fs.readFileSync(entry, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const fastify = new Proxy({}, { get: () => () => fastify });
    const adapter = { getInstance: () => fastify };
    const environment = new Proxy({}, { get: () => () => false });
    const app = new Proxy({}, { get: (_target, name) => {
      if (name === 'then') return undefined;
      if (name === 'get') return () => environment;
      if (name === 'getHttpAdapter') return () => adapter;
      if (name === 'listen') return async () => { throw new Error('injected legacy conversion failure'); };
      return () => undefined;
    } });
    class Empty {}
    const imports = {
      '@nestjs/core': { Reflector: Empty, NestFactory: { create: async () => {
        setInterval(() => {}, 1000);
        return app;
      } } },
      '@nestjs/platform-fastify': { FastifyAdapter: class { getInstance() { return fastify; } } },
      '@nestjs/common': {
        Logger: class { log() {} error(...args) { console.error(...args); } static error(...args) { console.error(...args); } },
        ValidationPipe: Empty, NotFoundException: Empty,
      },
      './ws/adapter/ws-redis.adapter': { WsRedisIoAdapter: class { async connectToRedis() {} } },
      './common/helpers': { overrideRequestIp() {}, resolveFrameHeader() { return null; } },
    };
    const stubRequire = (name) => imports[name] ?? new Proxy({}, { get: () => Empty });
    new Function('require', 'module', 'exports', compiled)(stubRequire, { exports: {} }, {});
  `, resolve(__dirname, 'main.ts'), require.resolve('typescript')], {
    encoding: 'utf8',
    timeout: 2_000,
  });

  expect(child.stderr).toContain('injected legacy conversion failure');
  expect(child.error).toBeUndefined();
  expect(child.signal).toBeNull();
  expect(child.status).toBe(1);
});
