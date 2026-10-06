import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EnvironmentService } from './environment.service';

describe('EnvironmentService', () => {
  let service: EnvironmentService;
  let config: Record<string, string>;

  beforeEach(async () => {
    config = {};
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnvironmentService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultValue?: string) =>
              config[key] ?? defaultValue,
          },
        },
      ],
    }).compile();

    service = module.get<EnvironmentService>(EnvironmentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns safe LDAP defaults when LDAP is disabled', () => {
    expect(service.getLdapConfig()).toEqual({
      enabled: false,
      url: undefined,
      bindDn: undefined,
      bindPassword: undefined,
      baseDn: undefined,
      userSearchFilter: undefined,
      userIdAttribute: undefined,
      userEmailAttribute: 'mail',
      userNameAttribute: 'displayName',
      startTls: false,
      tlsCaCertPath: undefined,
      connectTimeoutMs: 5000,
      searchTimeoutMs: 5000,
    });
  });

  it('reads LDAP settings from configuration', () => {
    Object.assign(config, {
      LDAP_ENABLED: 'true',
      LDAP_URL: 'ldaps://ldap.example.com:636',
      LDAP_BIND_DN: 'cn=docmost,dc=example,dc=com',
      LDAP_BIND_PASSWORD: 'secret',
      LDAP_BASE_DN: 'dc=example,dc=com',
      LDAP_USER_SEARCH_FILTER: '(uid={{username}})',
      LDAP_USER_ID_ATTRIBUTE: 'entryUUID',
      LDAP_STARTTLS: 'true',
      LDAP_CONNECT_TIMEOUT_MS: '3000',
      LDAP_SEARCH_TIMEOUT_MS: '4000',
    });

    expect(service.getLdapConfig()).toMatchObject({
      enabled: true,
      url: 'ldaps://ldap.example.com:636',
      bindDn: 'cn=docmost,dc=example,dc=com',
      bindPassword: 'secret',
      baseDn: 'dc=example,dc=com',
      userSearchFilter: '(uid={{username}})',
      userIdAttribute: 'entryUUID',
      startTls: true,
      connectTimeoutMs: 3000,
      searchTimeoutMs: 4000,
    });
  });
});
