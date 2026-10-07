import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  OAuthAuthorizeDto,
  OAuthDisconnectDto,
  UninstallIntegrationDto,
} from './integration.dto';

describe.each([
  ['UninstallIntegrationDto', UninstallIntegrationDto],
  ['OAuthAuthorizeDto', OAuthAuthorizeDto],
  ['OAuthDisconnectDto', OAuthDisconnectDto],
])('%s integrationId', (_name, Dto) => {
  const violations = async (integrationId: unknown) => {
    const errors = await validate(plainToInstance(Dto, { integrationId }));
    return errors.flatMap((e) => Object.keys(e.constraints ?? {}));
  };

  it('accepts a uuid7', async () => {
    expect(await violations('019a1b2c-3d4e-7f00-8a00-123456789abc')).toEqual([]);
  });

  it.each([
    ['a non-UUID string', 'integration-1'],
    ['an empty string', ''],
    ['a number', 42],
    ['a missing value', undefined],
  ])('rejects %s', async (_label, integrationId) => {
    expect(await violations(integrationId)).toContain('isUuid');
  });
});

describe('OAuthAuthorizeDto returnPath', () => {
  const violations = async (returnPath: string) => {
    const errors = await validate(
      plainToInstance(OAuthAuthorizeDto, {
        integrationId: '019a1b2c-3d4e-7f00-8a00-123456789abc',
        returnPath,
      }),
    );
    return errors.flatMap((e) => Object.keys(e.constraints ?? {}));
  };

  it('accepts a workspace path with a query', async () => {
    expect(await violations('/settings/account/connections?connect=github')).toEqual([]);
  });

  it.each([
    ['a protocol-relative path', '//evil.example'],
    ['a backslash', '/\\evil.example'],
    ['an escape character', '/settings\x1b[2J'],
    ['a NUL byte', '/settings\x00'],
    ['DEL', '/settings\x7f'],
  ])('rejects %s', async (_label, returnPath) => {
    expect(await violations(returnPath)).toContain('matches');
  });
});
