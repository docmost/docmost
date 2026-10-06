import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { Client, type Entry } from 'ldapts';
import { EnvironmentService } from '../../../integrations/environment/environment.service';
import { LdapAuthService, escapeLdapFilterValue } from './ldap-auth.service';

const mockClient = {
  bind: jest.fn(),
  search: jest.fn(),
  startTLS: jest.fn(),
  unbind: jest.fn(),
};

jest.mock('ldapts', () => ({
  Client: jest.fn().mockImplementation(() => mockClient),
}));

const defaultConfig = {
  enabled: true,
  url: 'ldaps://ldap.example.com:636',
  bindDn: 'cn=service,dc=example,dc=com',
  bindPassword: 'service-secret',
  baseDn: 'ou=people,dc=example,dc=com',
  userSearchFilter: '(uid={{username}})',
  userIdAttribute: 'entryUUID',
  userEmailAttribute: 'mail',
  userNameAttribute: 'displayName',
  startTls: false,
  tlsCaCertPath: undefined,
  connectTimeoutMs: 3000,
  searchTimeoutMs: 4000,
};

const directoryEntry: Entry = {
  dn: 'uid=alice,ou=people,dc=example,dc=com',
  entryUUID: 'stable-id-1',
  mail: 'alice@example.com',
  displayName: 'Alice Example',
};

describe('LdapAuthService', () => {
  let config: typeof defaultConfig;
  let service: LdapAuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    config = { ...defaultConfig };
    mockClient.bind.mockResolvedValue(undefined);
    mockClient.startTLS.mockResolvedValue(undefined);
    mockClient.unbind.mockResolvedValue(undefined);
    mockClient.search.mockResolvedValue({
      searchEntries: [directoryEntry],
      searchReferences: [],
    });

    service = new LdapAuthService({
      getLdapConfig: () => config,
    } as unknown as EnvironmentService);
  });

  it('binds the service account, searches, then binds the matched user', async () => {
    await expect(service.authenticate('alice', 'user-secret')).resolves.toEqual(
      {
        subjectId: 'stable-id-1',
        email: 'alice@example.com',
        name: 'Alice Example',
      },
    );

    expect(Client).toHaveBeenCalledWith(
      expect.objectContaining({
        url: defaultConfig.url,
        timeout: 4000,
        connectTimeout: 3000,
        tlsOptions: { rejectUnauthorized: true },
      }),
    );
    expect(mockClient.bind.mock.calls).toEqual([
      [defaultConfig.bindDn, defaultConfig.bindPassword],
      [directoryEntry.dn, 'user-secret'],
    ]);
    expect(mockClient.search).toHaveBeenCalledWith(
      defaultConfig.baseDn,
      expect.objectContaining({
        filter: '(uid=alice)',
        scope: 'sub',
        sizeLimit: 2,
        timeLimit: 4,
      }),
    );
    expect(mockClient.unbind).toHaveBeenCalledTimes(1);
  });

  it('escapes filter metacharacters in the supplied username', async () => {
    await service.authenticate('a*)(uid=*)', 'user-secret');

    expect(mockClient.search).toHaveBeenCalledWith(
      defaultConfig.baseDn,
      expect.objectContaining({ filter: '(uid=a\\2a\\29\\28uid=\\2a\\29)' }),
    );
  });

  it('returns a generic authentication error when the search has no unique result', async () => {
    mockClient.search.mockResolvedValueOnce({
      searchEntries: [directoryEntry, directoryEntry],
      searchReferences: [],
    });

    await expect(service.authenticate('alice', 'user-secret')).rejects.toThrow(
      new UnauthorizedException('Invalid username or password'),
    );
    expect(mockClient.bind).toHaveBeenCalledTimes(1);
    expect(mockClient.unbind).toHaveBeenCalledTimes(1);
  });

  it('rejects a search with no matching users', async () => {
    mockClient.search.mockResolvedValueOnce({
      searchEntries: [],
      searchReferences: [],
    });

    await expect(service.authenticate('alice', 'user-secret')).rejects.toThrow(
      'Invalid username or password',
    );
    expect(mockClient.bind).toHaveBeenCalledTimes(1);
    expect(mockClient.unbind).toHaveBeenCalledTimes(1);
  });

  it('uses StartTLS before binding when configured', async () => {
    config = { ...config, url: 'ldap://ldap.example.com:389', startTls: true };

    await service.authenticate('alice', 'user-secret');

    expect(mockClient.startTLS).toHaveBeenCalledWith({
      rejectUnauthorized: true,
    });
    expect(mockClient.startTLS.mock.invocationCallOrder[0]).toBeLessThan(
      mockClient.bind.mock.invocationCallOrder[0],
    );
  });

  it('returns a generic error and closes the client when the TLS upgrade fails', async () => {
    config = { ...config, url: 'ldap://ldap.example.com:389', startTls: true };
    mockClient.startTLS.mockRejectedValueOnce(
      new Error('sensitive certificate detail'),
    );

    await expect(service.authenticate('alice', 'user-secret')).rejects.toThrow(
      'Invalid username or password',
    );
    expect(mockClient.bind).not.toHaveBeenCalled();
    expect(mockClient.unbind).toHaveBeenCalledTimes(1);
  });

  it('returns a generic authentication error and closes the client on bind failure', async () => {
    mockClient.bind
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('sensitive directory detail'));

    await expect(service.authenticate('alice', 'wrong-secret')).rejects.toThrow(
      'Invalid username or password',
    );
    expect(mockClient.unbind).toHaveBeenCalledTimes(1);
  });

  it('closes the client after a search error without exposing the directory error', async () => {
    mockClient.search.mockRejectedValueOnce(new Error('internal directory detail'));

    await expect(service.authenticate('alice', 'user-secret')).rejects.toThrow(
      'Invalid username or password',
    );
    expect(mockClient.unbind).toHaveBeenCalledTimes(1);
  });

  it('does not create a client when LDAP is disabled', async () => {
    config = { ...config, enabled: false };

    await expect(service.authenticate('alice', 'user-secret')).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(Client).not.toHaveBeenCalled();
  });
});

describe('escapeLdapFilterValue', () => {
  it('escapes LDAP filter syntax characters and NUL', () => {
    expect(escapeLdapFilterValue('a*()\\\0b')).toBe('a\\2a\\28\\29\\5c\\00b');
  });
});